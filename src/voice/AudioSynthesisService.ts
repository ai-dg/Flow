/**
 * AudioSynthesisService — the Text-to-Speech layer for the canvas OS.
 *
 * Strategy ladder (best → fallback):
 *
 *  1. ElevenLabs (default): cloud neural TTS via the official SDK, using the
 *     low-latency `eleven_flash_v2_5` model. Each sentence is synthesized to
 *     MP3 over the network, decoded with WebAudio, and played back. No model
 *     download and no local inference — synthesis is faster than real-time, so
 *     once the queue is primed there are no gaps between sentences.
 *  2. Native `speechSynthesis` with a best-voice filter — instant, offline
 *     fallback used whenever ElevenLabs is disabled, has no API key, or a
 *     request fails, so the demo is never silent.
 *
 * A sentence queue guarantees sequential, non-overlapping playback. Requests
 * are pipelined: the next sentence is synthesized while the current one plays.
 */
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/** Low-latency ElevenLabs model requested for every utterance. */
const ELEVENLABS_MODEL = "eleven_flash_v2_5";
/** Default prebuilt voice — "George", a warm British male → JARVIS. */
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export interface AudioSynthesisOptions {
  rate?: number;
  pitch?: number;
  /** ElevenLabs voice id (defaults to the "George" British male voice). */
  voiceId?: string;
  /** Disable ElevenLabs and use the native speechSynthesis path only. */
  disableElevenLabs?: boolean;
  /** Fires true when playback starts, false when the queue drains. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Surfaces a transient status string (e.g. an error), null when clear. */
  onVoiceLoading?: (message: string | null) => void;
}

/** A pre-generated, ready-to-play sentence. */
export interface SynthHandle {
  /** Plays the audio, resolving when it finishes. */
  play(): Promise<void>;
  /** Audio length in ms — used to pace the on-screen text reveal in sync. */
  durationMs: number;
}

interface RawAudio {
  audio: Float32Array;
  sampling_rate: number;
}

/**
 * A sentence whose audio has (where possible) already been synthesized, ready to
 * play with no further compute. `audio: null` means ElevenLabs was unavailable
 * for this sentence — fall through to the native path at play time.
 */
interface Prepared {
  text: string;
  audio: Float32Array | null;
  sampleRate: number;
}

/** Ranks native voices so the least-robotic one wins (best-effort fallback). */
function selectBestVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  if (!voices.length) return null;
  const english = voices.filter((v) => /^en/i.test(v.lang));
  const pool = english.length ? english : voices;
  const score = (v: SpeechSynthesisVoice): number => {
    const name = v.name.toLowerCase();
    let s = 0;
    if (name.includes("natural")) s += 100;
    if (name.includes("google")) s += 60;
    if (name.includes("microsoft")) s += 40;
    if (/\b(aria|jenny|guy|denise|libby|sonia|emma|ava|andrew)\b/.test(name))
      s += 20;
    if (/en[-_]us/i.test(v.lang)) s += 10;
    if (!v.localService) s += 5;
    return s;
  };
  return [...pool].sort((a, b) => score(b) - score(a))[0] ?? voices[0];
}

/** Drain a ReadableStream<Uint8Array> into a single contiguous buffer. */
async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      total += value.length;
    }
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

export class AudioSynthesisService {
  private queue: string[] = [];
  private active = false;
  // When muted, all narration is silent — but the on-screen text/widget pacing
  // still runs (synthesize returns a timed, soundless handle) so the demo looks
  // identical. Handy while programming / running tests with no voice.
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private audioCtx: AudioContext | null = null;
  // The buffer source currently sounding (ElevenLabs path) — tracked so cancel()
  // can cut it off mid-sentence, not just stop the native fallback.
  private currentSource: AudioBufferSourceNode | null = null;
  private readonly supported: boolean;

  // ElevenLabs (cloud neural TTS). Null when disabled or no API key is set, in
  // which case every sentence falls through to native speechSynthesis.
  private readonly client: ElevenLabsClient | null;
  private readonly voiceId: string;
  /** Logged only once so a missing key / repeated failure doesn't spam. */
  private warnedNoCloud = false;

  constructor(private readonly opts: AudioSynthesisOptions = {}) {
    this.supported =
      typeof window !== "undefined" && "speechSynthesis" in window;
    this.voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
    if (this.supported) this.loadVoices();

    const apiKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;
    if (!opts.disableElevenLabs && apiKey) {
      this.client = new ElevenLabsClient({ apiKey });
    } else {
      this.client = null;
      if (!opts.disableElevenLabs && !apiKey) {
        console.warn(
          "[tts] VITE_ELEVENLABS_API_KEY not set — using native voice",
        );
      }
    }
  }

  private loadVoices(): void {
    const pick = () => {
      this.voice = selectBestVoice(window.speechSynthesis.getVoices());
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
  }

  /**
   * Synthesize one sentence to audio via ElevenLabs, decoded to raw PCM samples
   * ready for WebAudio playback. Resolves null when the cloud client is
   * unavailable or the request fails, so callers fall back to native speech.
   */
  private async generateViaCloud(text: string): Promise<RawAudio | null> {
    if (!this.client) return null;
    try {
      const stream = await this.client.textToSpeech.convert(this.voiceId, {
        text,
        modelId: ELEVENLABS_MODEL,
        outputFormat: "mp3_44100_128",
      });
      const bytes = await collectStream(stream);
      const ctx = this.ctx();
      // decodeAudioData detaches the buffer; hand it a fresh, owned ArrayBuffer.
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const decoded = await ctx.decodeAudioData(ab);
      // Collapse to mono — narration is single-channel and playBuffer mirrors it.
      const audio = new Float32Array(decoded.getChannelData(0));
      this.opts.onVoiceLoading?.(null);
      return { audio, sampling_rate: decoded.sampleRate };
    } catch (err) {
      if (!this.warnedNoCloud) {
        console.error("[tts] ElevenLabs synth failed, native fallback", err);
        this.warnedNoCloud = true;
      }
      return null;
    }
  }

  /** Mute/unmute all narration. Muting stops anything currently playing. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) this.cancel();
  }

  /** Whether narration is currently muted. */
  isMuted(): boolean {
    return this.muted;
  }

  /** Enqueue one sentence for sequential playback. */
  queueSentence(text: string): void {
    if (this.muted) return;
    const clean = text.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (!clean || !/[a-z0-9]/i.test(clean)) return;
    this.queue.push(clean);
    if (!this.active) void this.drain();
  }

  /**
   * Pre-generate audio for one sentence WITHOUT playing it. The caller can
   * prefetch the next sentence while the current one plays (no gaps) and pace
   * the on-screen text to `durationMs` so voice and text stay in sync.
   */
  async synthesize(text: string): Promise<SynthHandle> {
    const clean = text.replace(/\|/g, " ").replace(/\s+/g, " ").trim();
    if (!clean || !/[a-z0-9]/i.test(clean)) {
      return { play: () => Promise.resolve(), durationMs: 0 };
    }
    // Muted: stay silent but keep the on-screen pacing — estimate a duration
    // from word count and resolve play() after that long without any audio.
    if (this.muted) {
      const words = clean.split(/\s+/).length;
      const durationMs = Math.max(800, words * 320);
      return {
        durationMs,
        play: () => new Promise<void>((resolve) => setTimeout(resolve, durationMs)),
      };
    }
    const out = await this.generateViaCloud(clean);
    if (out) {
      return {
        durationMs: (out.audio.length / out.sampling_rate) * 1000,
        play: () => {
          this.opts.onSpeakingChange?.(true);
          return this.playBuffer(out.audio, out.sampling_rate);
        },
      };
    }
    // Native can't be pre-generated → estimate duration from word count.
    const words = clean.split(/\s+/).length;
    return {
      durationMs: Math.max(800, words * 320),
      play: () => {
        this.opts.onSpeakingChange?.(true);
        return this.playWebSpeech(clean);
      },
    };
  }

  /** Stop immediately and clear everything queued. */
  cancel(): void {
    this.queue = [];
    this.active = false;
    // Cut off any ElevenLabs buffer mid-playback (native is handled below).
    // stop() fires the source's `onended`, which resolves the pending play()
    // promise — so we must NOT clear that handler here.
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {
        /* already stopped */
      }
      this.currentSource = null;
    }
    if (this.supported) window.speechSynthesis.cancel();
    this.opts.onSpeakingChange?.(false);
  }

  /**
   * Synthesize one sentence's audio ahead of play time. Resolves a `Prepared`
   * whose `audio` is the decoded ElevenLabs buffer when available, or null to
   * defer to the native path. Never rejects — a failed synth just yields null
   * audio so the caller falls back gracefully.
   */
  private async prepare(text: string): Promise<Prepared> {
    const out = await this.generateViaCloud(text);
    if (out) return { text, audio: out.audio, sampleRate: out.sampling_rate };
    return { text, audio: null, sampleRate: 0 };
  }

  /** Play an already-prepared sentence via the best available path. */
  private playPrepared(p: Prepared): Promise<void> {
    if (p.audio) return this.playBuffer(p.audio, p.sampleRate);
    return this.playWebSpeech(p.text);
  }

  /**
   * Pipelined playback: while the current sentence plays, the next one is
   * already being synthesized over the network. Flash synthesis runs faster
   * than real-time, so once primed the gap between sentences collapses to
   * ~zero. Only the very first sentence pays the cold request latency.
   */
  private async drain(): Promise<void> {
    this.active = true;
    this.opts.onSpeakingChange?.(true);

    // Holds the next sentence already being synthesized off the main thread.
    let lookahead: Promise<Prepared> | null = null;

    while (this.active) {
      // Use the prefetched sentence if we have one; otherwise pull a fresh one.
      let currentPromise = lookahead;
      lookahead = null;
      if (!currentPromise) {
        const text = this.queue.shift();
        if (text === undefined) break; // nothing left to say
        currentPromise = this.prepare(text);
      }
      const current = await currentPromise;
      if (!this.active) break; // cancelled while this sentence was synthesizing

      // Kick off synthesis of the next sentence so it overlaps this playback.
      const nextText = this.queue.shift();
      if (nextText !== undefined) lookahead = this.prepare(nextText);

      try {
        await this.playPrepared(current);
      } catch (err) {
        console.error("[tts] playback failed, falling back to native", err);
        try {
          await this.playWebSpeech(current.text);
        } catch {
          /* give up on this sentence */
        }
      }
    }

    this.active = false;
    this.opts.onSpeakingChange?.(false);
  }

  private ctx(): AudioContext {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!this.audioCtx) this.audioCtx = new Ctx();
    return this.audioCtx;
  }

  private async playBuffer(
    samples: Float32Array,
    sampleRate: number,
  ): Promise<void> {
    const ctx = this.ctx();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = ctx.createBuffer(1, samples.length, sampleRate);
    buffer.getChannelData(0).set(samples);
    await new Promise<void>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => {
        if (this.currentSource === src) this.currentSource = null;
        resolve();
      };
      this.currentSource = src;
      src.start();
    });
  }

  // ── Fallback: native speechSynthesis (instant, offline) ───────────────────
  private playWebSpeech(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!this.supported) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      if (this.voice) u.voice = this.voice;
      u.lang = this.voice?.lang ?? "en-US";
      u.rate = this.opts.rate ?? 1.05;
      u.pitch = this.opts.pitch ?? 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      window.speechSynthesis.speak(u);
    });
  }
}
