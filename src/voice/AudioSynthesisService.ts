/**
 * AudioSynthesisService — the Text-to-Speech layer for the canvas OS.
 *
 * Strategy ladder (best → fallback), all free & zero-config:
 *
 *  1. Kokoro-82M (default): a neural TTS model run 100% locally in the browser
 *     via kokoro-js / ONNX. Genuinely natural voice — crucial on Linux, where
 *     the native `speechSynthesis` only exposes robotic eSpeak voices. The
 *     ~80 MB model downloads once and is cached. Inference runs in a dedicated
 *     Web Worker (see `kokoroWorker.ts`) so it never blocks / freezes the UI.
 *  2. Streaming endpoint (opt-in): POST each sentence to a local OSS TTS server.
 *  3. Native `speechSynthesis` with a best-voice filter — instant fallback so
 *     the demo is never silent while Kokoro loads or if it fails.
 *
 * A sentence queue guarantees sequential, non-overlapping playback.
 */

export interface AudioSynthesisOptions {
  rate?: number;
  pitch?: number;
  /** Kokoro voice id (e.g. "bm_george", "af_heart", "am_michael"). */
  kokoroVoice?: string;
  /** Disable the local Kokoro model and use the native/stream paths only. */
  disableKokoro?: boolean;
  /** Optional streaming TTS endpoint: `POST { text }` → audio bytes. */
  streamingEndpoint?: string;
  /** Fires true when playback starts, false when the queue drains. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** Progress while the Kokoro model downloads (string), null when ready. */
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
 * play with no further compute. `audio: null` means Kokoro was unavailable for
 * this sentence — fall through to the streaming/native paths at play time.
 */
interface Prepared {
  text: string;
  audio: Float32Array | null;
  sampleRate: number;
}

// ── Worker message shapes ─────────────────────────────────────────────────────
type WorkerOut =
  | { type: "progress"; message: string }
  | { type: "ready" }
  | { type: "load-error"; message: string }
  | { type: "result"; id: number; audio: Float32Array; samplingRate: number }
  | { type: "error"; id: number; message: string };

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

export class AudioSynthesisService {
  private queue: string[] = [];
  private active = false;
  // When muted, all narration is silent — but the on-screen text/widget pacing
  // still runs (synthesize returns a timed, soundless handle) so the demo looks
  // identical. Handy while programming / running tests with no voice.
  private muted = false;
  private voice: SpeechSynthesisVoice | null = null;
  private audioCtx: AudioContext | null = null;
  private readonly supported: boolean;

  // Kokoro (local neural TTS) — runs in a Web Worker so inference never blocks
  // the main thread.
  private worker: Worker | null = null;
  private workerFailed = false;
  private reqId = 0;
  private readonly pending = new Map<
    number,
    { resolve: (a: RawAudio) => void; reject: (e: Error) => void }
  >();
  private readonly kokoroVoice: string;

  constructor(private readonly opts: AudioSynthesisOptions = {}) {
    this.supported =
      typeof window !== "undefined" && "speechSynthesis" in window;
    this.kokoroVoice = opts.kokoroVoice ?? "bm_george"; // British male → JARVIS
    if (this.supported) this.loadVoices();
    // Warm up the neural model immediately so it's ready by first utterance.
    if (!opts.disableKokoro) this.ensureWorker();
  }

  private loadVoices(): void {
    const pick = () => {
      this.voice = selectBestVoice(window.speechSynthesis.getVoices());
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
  }

  /** Lazily spins up the TTS worker and wires its message handlers. */
  private ensureWorker(): Worker | null {
    if (this.opts.disableKokoro || this.workerFailed) return null;
    if (this.worker) return this.worker;
    try {
      this.worker = new Worker(
        new URL("./kokoroWorker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) =>
        this.onWorkerMessage(e.data);
      this.worker.onerror = () => {
        this.workerFailed = true;
        this.opts.onVoiceLoading?.(null);
        this.rejectAllPending(new Error("tts worker crashed"));
      };
      this.worker.postMessage({ type: "warm" });
    } catch (err) {
      console.error("[tts] worker init failed, using native voice", err);
      this.workerFailed = true;
      return null;
    }
    return this.worker;
  }

  private onWorkerMessage(msg: WorkerOut): void {
    switch (msg.type) {
      case "progress":
        this.opts.onVoiceLoading?.(msg.message);
        break;
      case "ready":
        this.opts.onVoiceLoading?.(null);
        break;
      case "load-error":
        this.workerFailed = true;
        this.opts.onVoiceLoading?.(null);
        this.rejectAllPending(new Error(msg.message));
        break;
      case "result": {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          const audio = this.trimSilence(msg.audio, msg.samplingRate);
          p.resolve({ audio, sampling_rate: msg.samplingRate });
        }
        break;
      }
      case "error": {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.reject(new Error(msg.message));
        }
        break;
      }
    }
  }

  private rejectAllPending(err: Error): void {
    for (const { reject } of this.pending.values()) reject(err);
    this.pending.clear();
  }

  /**
   * Kokoro pads every clip with ~200-400ms of near-silence at the head and tail.
   * Played sentence-by-sentence, that padding stacks into a long gap between
   * sentences. Crop both ends down to a short pad so narration flows with only a
   * natural micro-pause. Trimming here keeps `durationMs` (text pacing) in sync,
   * since it's derived from the returned audio length.
   */
  private trimSilence(samples: Float32Array, sampleRate: number): Float32Array {
    const threshold = 0.01;                       // |amplitude| below this = silence
    const pad = Math.floor(sampleRate * 0.04);    // keep ~40ms breathing room
    let start = 0;
    let end = samples.length - 1;
    while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
    while (end > start && Math.abs(samples[end]) < threshold) end--;
    if (start >= end) return samples;             // all-silence guard — leave as-is
    start = Math.max(0, start - pad);
    end = Math.min(samples.length - 1, end + pad);
    return samples.subarray(start, end + 1);
  }

  /** Generate audio off-thread. Resolves null if the worker is unavailable. */
  private generateViaWorker(text: string): Promise<RawAudio | null> {
    const worker = this.ensureWorker();
    if (!worker) return Promise.resolve(null);
    const id = ++this.reqId;
    return new Promise<RawAudio>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ type: "generate", id, text, voice: this.kokoroVoice });
    }).catch((err) => {
      console.error("[tts] worker synth failed, native fallback", err);
      return null;
    });
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
    if (!this.opts.disableKokoro) {
      const out = await this.generateViaWorker(clean);
      if (out) {
        return {
          durationMs: (out.audio.length / out.sampling_rate) * 1000,
          play: () => {
            this.opts.onSpeakingChange?.(true);
            return this.playBuffer(out.audio, out.sampling_rate);
          },
        };
      }
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
    if (this.supported) window.speechSynthesis.cancel();
    this.opts.onSpeakingChange?.(false);
  }

  /**
   * Synthesize one sentence's audio ahead of play time. Resolves a `Prepared`
   * whose `audio` is the Kokoro buffer when available, or null to defer to the
   * streaming/native paths. Never rejects — a failed synth just yields null
   * audio so the caller falls back gracefully.
   */
  private async prepare(text: string): Promise<Prepared> {
    if (!this.opts.disableKokoro) {
      const out = await this.generateViaWorker(text);
      if (out) return { text, audio: out.audio, sampleRate: out.sampling_rate };
    }
    return { text, audio: null, sampleRate: 0 };
  }

  /** Play an already-prepared sentence via the best available path. */
  private playPrepared(p: Prepared): Promise<void> {
    if (p.audio) return this.playBuffer(p.audio, p.sampleRate);
    if (this.opts.streamingEndpoint) return this.playStreaming(p.text);
    return this.playWebSpeech(p.text);
  }

  /**
   * Pipelined playback: while the current sentence plays, the next one is
   * already being synthesized. Kokoro inference runs faster than real-time, so
   * once primed the gap between sentences collapses to ~zero. Only the very
   * first sentence pays the cold synth latency.
   */
  private async drain(): Promise<void> {
    this.active = true;
    this.opts.onSpeakingChange?.(true);

    // Holds the next sentence already being synthesized off-thread.
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
      src.onended = () => resolve();
      src.start();
    });
  }

  // ── Strategy 2: streaming OSS endpoint ────────────────────────────────────
  private async playStreaming(text: string): Promise<void> {
    const res = await fetch(this.opts.streamingEndpoint as string, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`TTS endpoint ${res.status}`);
    const bytes = await res.arrayBuffer();
    const ctx = this.ctx();
    if (ctx.state === "suspended") await ctx.resume();
    const buffer = await ctx.decodeAudioData(bytes);
    await new Promise<void>((resolve) => {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => resolve();
      src.start();
    });
  }

  // ── Strategy 3: native speechSynthesis (instant fallback) ─────────────────
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
