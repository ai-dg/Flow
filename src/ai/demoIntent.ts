/**
 * Demo intent classifier — the "agent" that decides whether a free-form spoken
 * utterance is semantically trying to trigger the current scripted demo step.
 *
 * Used as a fallback after the fast word-overlap heuristic in App.tsx misses, so
 * loose paraphrases ("show me what's on today") still advance the demo. Runs on
 * Haiku for low latency, with a hard timeout and a safe NO fallback — a slow or
 * failed call never blocks or breaks the demo; it just routes to live Claude.
 *
 * See App.tsx → handleUtterance and demoStore.ts (voiceButtonLabel).
 */

import { generateText } from "ai";
import { anthropic, hasApiKey } from "./client";

// Small/fast model — this is a one-word YES/NO classification, not generation.
const CLASSIFIER_MODEL = "claude-haiku-4-5-20251001";

/** Strip the 🎤 prefix + surrounding quotes from a voiceButtonLabel. */
function barePhrase(label: string): string {
  return label
    .replace(/[\u{1F000}-\u{1FFFF}]/gu, "") // emoji
    .replace(/["“”]/g, "")
    .trim();
}

/**
 * True when `utterance` is (loosely) trying to trigger the demo command shown in
 * `label`. Returns false on timeout, error, or missing API key so the caller can
 * safely fall through to the normal live-AI path.
 */
export async function matchesDemoIntent(
  utterance: string,
  label: string,
  timeoutMs = 2500,
): Promise<boolean> {
  if (!hasApiKey || !utterance.trim()) return false;

  const target = barePhrase(label);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const { text } = await generateText({
      model: anthropic(CLASSIFIER_MODEL),
      temperature: 0,
      maxOutputTokens: 4,
      system:
        "You are an intent matcher for a scripted product demo. Given the demo's " +
        "expected spoken command and what the user actually said, decide whether " +
        "the user is trying to trigger that command — even if phrased very " +
        "differently, shortened, or only loosely related in meaning. Reply with " +
        "exactly one word: YES or NO.",
      prompt: `Expected command: "${target}"\nUser said: "${utterance}"\n\nSame intent? Answer YES or NO.`,
      abortSignal: ctrl.signal,
    });
    return /\byes\b/i.test(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
