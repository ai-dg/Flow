/**
 * Agent 3 — Demo Progress Tracker.
 *
 * The third and last agent in the layered pipeline (Router → main conversation
 * agent → Tracker). Runs AFTER every feature activation, asynchronously and
 * fire-and-forget — the UI never awaits it and it never touches the canvas or
 * any UI. Its only job is to compare *what just happened* (the activation event)
 * against a fixed checklist of demo steps and report which step IDs are now
 * complete. `demoStore` applies the result via `markCompleted(...)`.
 *
 * Like the Router, the Tracker is an AI call: an even simpler, smaller prompt
 * than the Router's — a one-shot checklist comparison returning a compact JSON
 * array. A deterministic rule table is kept ONLY as an offline fallback for the
 * no-key / timeout / error path, so a missing key or a slow model can never
 * break the demo (CLAUDE.md rule #1). It returns step IDs only — never prose,
 * never UI work.
 *
 * See .claude/docs/AI_CONTRACT.md → Two-Agent Architecture.
 */

import { generateText } from "ai";
import { anthropic, hasApiKey } from "./client";

// Smallest/fastest model — this is a trivial classification, even lighter than
// the Router's call (tiny prompt, single-array output).
const TRACKER_MODEL = "claude-haiku-4-5-20251001";

/** What just happened — emitted by `demoStore` on every activation / widget lifecycle event. */
export interface ActivationEvent {
  /** The feature that was activated (todo-overview | qcm | lesson | mail-compose | …). */
  feature: string;
  params?: Record<string, unknown>;
  /** Widget lifecycle phase. `opened` is the activation itself; the rest are terminal. */
  phase?: "opened" | "submitted" | "sent" | "final-beat" | "skipped";
}

/** The fixed checklist: every demo-step id the Tracker can mark complete. */
const STEP_IDS = ["overview", "history-qcm", "send-homework", "maths-lesson"] as const;
type StepId = (typeof STEP_IDS)[number];
const STEP_SET: ReadonlySet<string> = new Set(STEP_IDS);

// ── Offline fallback: deterministic checklist (no-key / timeout / error) ───────
//
// Mirrors the AI checklist exactly so behaviour is identical when the model is
// unavailable. Kept tiny and pure.

function ruleTrack(event: ActivationEvent): StepId[] {
  switch (event.feature) {
    case "todo-overview":
      // Showing the overview completes the step immediately.
      return ["overview"];
    case "qcm":
      // Only completes once the student actually submits.
      return event.phase === "submitted" ? ["history-qcm"] : [];
    case "mail-compose":
      return event.phase === "sent" ? ["send-homework"] : [];
    case "lesson":
      // Reaching the final beat, or explicitly skipping the walkthrough.
      return event.phase === "final-beat" || event.phase === "skipped" ? ["maths-lesson"] : [];
    default:
      // project-switch / free-form / unknown → no demo step.
      return [];
  }
}

/** Deterministic fallback, with already-complete steps filtered out. */
function fallback(event: ActivationEvent, completed: Set<string>): string[] {
  return ruleTrack(event).filter((id) => !completed.has(id));
}

// ── Primary path: the Tracker AI call ──────────────────────────────────────────

const TRACKER_SYSTEM =
  "You are the Demo Progress Tracker for a voice-controlled school assistant. " +
  "Compare ONE event against this checklist and reply with ONLY a compact JSON array " +
  'of the step ids the event satisfies (e.g. ["overview"] or []). No prose, no fences.\n\n' +
  "Checklist — a step is satisfied when:\n" +
  '- "overview"       — feature=todo-overview (any phase).\n' +
  '- "history-qcm"    — feature=qcm AND phase=submitted.\n' +
  '- "send-homework"  — feature=mail-compose AND phase=sent.\n' +
  '- "maths-lesson"   — feature=lesson AND phase=final-beat OR phase=skipped.\n\n' +
  "Anything else (e.g. an `opened` phase that isn't terminal, project-switch, free-form) " +
  "satisfies NOTHING → reply []. Return at most the ids above, nothing invented.";

/** Keep only known step ids that aren't already complete. */
function sanitize(ids: unknown, completed: Set<string>): string[] {
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && STEP_SET.has(id) && !completed.has(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  return out;
}

async function aiTrack(
  event: ActivationEvent,
  completed: Set<string>,
  timeoutMs: number,
): Promise<string[]> {
  if (!hasApiKey) return fallback(event, completed);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const { text } = await generateText({
      model: anthropic(TRACKER_MODEL),
      temperature: 0,
      maxOutputTokens: 40,
      system: TRACKER_SYSTEM,
      prompt:
        `Event: feature=${event.feature} phase=${event.phase ?? "opened"}\n` +
        `Already complete: ${completed.size ? [...completed].join(", ") : "none"}\n\n` +
        `JSON array of newly-satisfied step ids:`,
      abortSignal: ctrl.signal,
    });
    const m = text.match(/\[[\s\S]*\]/);
    if (!m) return fallback(event, completed);
    try {
      return sanitize(JSON.parse(m[0]), completed);
    } catch {
      return fallback(event, completed);
    }
  } catch {
    // Timeout / network / missing key → deterministic fallback keeps the demo alive.
    return fallback(event, completed);
  } finally {
    clearTimeout(timer);
  }
}

// ── Public entry ──────────────────────────────────────────────────────────────

/**
 * Given an activation event and the current completed-step set, return the step
 * IDs that are *newly* satisfied (already-complete steps are filtered out).
 * Primary path is the Tracker AI call; falls back to the deterministic checklist
 * on no-key / timeout / error so the demo never stalls.
 */
export async function trackActivation(
  event: ActivationEvent,
  completed: Set<string>,
  timeoutMs = 2500,
): Promise<string[]> {
  return aiTrack(event, completed, timeoutMs);
}
