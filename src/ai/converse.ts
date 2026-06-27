import { streamText } from "ai";
import type { ModelMessage } from "ai";
import { anthropic, MODEL } from "./client";
import { SYSTEM_PROMPT } from "./systemPrompt";
import {
  dispatchCanvasCommands,
  dispatchWidgetDeclarations,
  dispatchCameraAction,
  type CanvasCommand,
  type WidgetDeclaration,
  type CameraAction,
} from "./orchestrate";

export interface ConverseCallbacks {
  /** Fires once per completed sentence — drive the ticker + TTS from here. */
  onSentence: (sentence: string) => void;
  /** Fires on every delta of the raw stream — for a live in-progress ticker. */
  onDelta?: (partial: string) => void;
}

export interface ConverseResult {
  /** Spoken text from the "speech" field — stored in conversation history. */
  spoken: string;
  /** Full raw JSON string — pushed as the assistant message for context. */
  rawJson: string;
}

const SENTENCE_RE = /([.!?]+)/;

/**
 * Scans a growing JSON buffer and extracts the value of the first matching
 * string field. We check for "speech" first (Visual Translation Framework
 * format) and the response always emits it as the first key so streaming
 * starts immediately.
 */
function extractStreamingSpeech(buf: string): { text: string; done: boolean } {
  // Try "speech" first; new format also uses it as the first field.
  for (const key of ['"speech"', '"reasoning_canvas_strategy"']) {
    const keyIdx = buf.indexOf(key);
    if (keyIdx === -1) continue;

    const colonIdx = buf.indexOf(":", keyIdx + key.length);
    if (colonIdx === -1) continue;

    let i = colonIdx + 1;
    while (i < buf.length && (buf[i] === " " || buf[i] === "\n" || buf[i] === "\r")) i++;
    if (i >= buf.length || buf[i] !== '"') continue;
    i++; // skip opening quote

    let text = "";
    while (i < buf.length) {
      const ch = buf[i];
      if (ch === "\\") {
        i++;
        if (i < buf.length) {
          const esc = buf[i];
          text += esc === "n" ? "\n" : esc === "t" ? "\t" : esc === "r" ? "\r" : esc;
        }
      } else if (ch === '"') {
        return { text, done: true };
      } else {
        text += ch;
      }
      i++;
    }
    return { text, done: false };
  }
  return { text: "", done: false };
}

/**
 * Runs one assistant turn using the Visual Translation Framework protocol:
 *
 *   1. Streams Claude's JSON response, buffering the full text.
 *   2. Extracts the "speech" field live as tokens arrive, emitting completed
 *      sentences immediately for TTS and the ticker.
 *   3. Once streaming ends, parses the full JSON.
 *      - If the response has a `widgets` array  → dispatchWidgetDeclarations
 *        (new Visual Translation Framework format — clears canvas first).
 *      - If the response has a `canvas` array   → dispatchCanvasCommands
 *        (legacy incremental format — no implicit clear).
 *   4. On malformed JSON, a fallback text widget is spawned so the canvas
 *      is never blank.
 */
export async function converse(
  history: ModelMessage[],
  callbacks: ConverseCallbacks
): Promise<ConverseResult> {
  const result = streamText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: history,
    temperature: 0.7,
  });

  let rawBuffer = "";
  let emittedSpeechLen = 0;
  let sentenceBuf = "";

  for await (const part of result.fullStream) {
    if (part.type === "text-delta") {
      rawBuffer += part.text;
      callbacks.onDelta?.(rawBuffer);

      const { text: speechSoFar } = extractStreamingSpeech(rawBuffer);
      const newChars = speechSoFar.slice(emittedSpeechLen);
      if (newChars) {
        emittedSpeechLen = speechSoFar.length;
        sentenceBuf += newChars;

        let match: RegExpMatchArray | null;
        while (
          (match = sentenceBuf.match(SENTENCE_RE)) &&
          match.index !== undefined
        ) {
          const end = match.index + match[0].length;
          const sentence = sentenceBuf.slice(0, end).trim();
          sentenceBuf = sentenceBuf.slice(end).trimStart();
          if (sentence) callbacks.onSentence(sentence);
        }
      }
    } else if (part.type === "error") {
      throw part.error;
    }
  }

  const tail = sentenceBuf.trim();
  if (tail) callbacks.onSentence(tail);

  let spoken = "";
  const json = rawBuffer.trim();

  try {
    const parsed = JSON.parse(json) as {
      speech?: string;
      reasoning_canvas_strategy?: string;
      widgets?: WidgetDeclaration[];
      canvas?: CanvasCommand[];
      camera?: CameraAction;
    };

    // Prefer "speech" for the spoken text; fall back to reasoning_canvas_strategy.
    spoken = parsed.speech ?? parsed.reasoning_canvas_strategy ?? "";

    if (Array.isArray(parsed.widgets) && parsed.widgets.length > 0) {
      dispatchWidgetDeclarations(parsed.widgets);
    } else if (Array.isArray(parsed.canvas) && parsed.canvas.length > 0) {
      dispatchCanvasCommands(parsed.canvas);
    }

    // Camera actions are optional and independent of widget spawning.
    if (parsed.camera) {
      dispatchCameraAction(parsed.camera);
    }
  } catch {
    spoken = json.slice(0, 300);
    dispatchCanvasCommands([
      {
        action: "spawn",
        type: "text",
        id: "fallback",
        x: 15, y: 25, w: 70, h: 40,
        data: { text: json },
      },
    ]);
  }

  return { spoken, rawJson: json };
}
