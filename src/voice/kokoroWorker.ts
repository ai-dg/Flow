/// <reference lib="webworker" />
/**
 * Kokoro TTS Web Worker.
 *
 * The Kokoro-82M neural model is heavy: running its ONNX inference on the main
 * thread froze the whole UI for the duration of every sentence. Here it runs
 * entirely off-thread — the worker owns the model and returns raw audio samples
 * (transferred, zero-copy) for the main thread to play via WebAudio.
 */
import { KokoroTTS } from "kokoro-js";

interface RawAudio {
  audio: Float32Array;
  sampling_rate: number;
}
interface KokoroLike {
  generate(text: string, opts: { voice: string }): Promise<RawAudio>;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let ttsPromise: Promise<KokoroLike> | null = null;

/** True when the browser exposes a usable WebGPU adapter. */
async function hasWebGPU(): Promise<boolean> {
  try {
    const gpu = (navigator as unknown as {
      gpu?: { requestAdapter(): Promise<unknown> };
    }).gpu;
    return gpu ? (await gpu.requestAdapter()) != null : false;
  } catch {
    return false;
  }
}

function init(device: "webgpu" | "wasm", dtype: string): Promise<KokoroLike> {
  return KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
    dtype,
    device,
    progress_callback: (p: { status?: string; progress?: number }) => {
      if (p?.status === "progress" && typeof p.progress === "number") {
        ctx.postMessage({
          type: "progress",
          message: `Loading neural voice… ${Math.round(p.progress)}%`,
        });
      }
    },
  } as unknown as Record<string, unknown>) as Promise<KokoroLike>;
}

/**
 * Load the model on the fastest available backend. WebGPU synthesizes several
 * times faster than the WASM/CPU path — on most machines WASM is slower than
 * real-time, which is what leaves audible gaps between sentences. Falls back to
 * WASM automatically when WebGPU is absent or fails to initialise, so the voice
 * still works everywhere.
 */
function load(): Promise<KokoroLike> {
  if (ttsPromise) return ttsPromise;
  ttsPromise = (async () => {
    if (await hasWebGPU()) {
      try {
        const tts = await init("webgpu", "fp32");
        ctx.postMessage({ type: "ready" });
        return tts;
      } catch (err) {
        console.warn("[tts] webgpu init failed, falling back to wasm", err);
        ctx.postMessage({
          type: "progress",
          message: "GPU voice unavailable — using CPU…",
        });
      }
    }
    const tts = await init("wasm", "q8");
    ctx.postMessage({ type: "ready" });
    return tts;
  })().catch((err: unknown) => {
    ctx.postMessage({
      type: "load-error",
      message: String((err as Error)?.message ?? err),
    });
    ttsPromise = null; // allow a later retry / native fallback
    throw err;
  });
  return ttsPromise;
}

ctx.onmessage = async (e: MessageEvent) => {
  const data = e.data;
  if (data?.type === "warm") {
    load().catch(() => {});
    return;
  }
  if (data?.type === "generate") {
    const { id, text, voice } = data as { id: number; text: string; voice: string };
    try {
      const tts = await load();
      const out = await tts.generate(text, { voice });
      const audio = out.audio;
      ctx.postMessage(
        { type: "result", id, audio, samplingRate: out.sampling_rate },
        [audio.buffer],
      );
    } catch (err) {
      ctx.postMessage({
        type: "error",
        id,
        message: String((err as Error)?.message ?? err),
      });
    }
  }
};
