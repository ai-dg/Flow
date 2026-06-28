/**
 * Agent 1 — Intent Router.
 *
 * Runs FIRST on every utterance (voice or text), before the main AI response, so
 * it must be fast and cheap. It uses AI judgment (not exact string matching) to
 * classify the input into ONE intent and emits a small structured decision —
 * `{ intent, params, confidence }`, never prose. It is given the current project
 * context, the available homeworks, and whether a lesson is currently active, so
 * it can route to a *specific* homework and only allow `lesson-advance` in
 * context.
 *
 * Two tiers, cheapest first:
 *   1. `fastRoute` — instant, offline heuristic. High-precision short-circuits
 *      for the obvious phrases (keeps the demo working with no API key).
 *   2. `aiRoute`   — a single low-latency Haiku call returning compact JSON.
 * If confidence is below CONFIDENCE_THRESHOLD — or on timeout/error/missing key —
 * the decision defaults to `free-form`, so a slow/uncertain Router never blocks
 * the demo; it just falls through to the main `converse()` loop.
 *
 * See .claude/docs/AI_CONTRACT.md → Two-Agent Architecture.
 */

import { generateText } from "ai";
import { anthropic, hasApiKey } from "./client";

// Small/fast model — this is a one-shot classification, not generation.
const ROUTER_MODEL = "claude-haiku-4-5-20251001";

/** Below this, we treat the decision as uncertain and fall back to free-form. */
const CONFIDENCE_THRESHOLD = 0.5;

export type Intent =
  | "show-todo"
  | "open-homework"
  | "compose-mail"
  | "switch-project"
  | "lesson-advance"
  | "free-form";

export interface RoutingParams {
  projectId?: string;
  homeworkId?: string;
}

export interface RoutingDecision {
  intent: Intent;
  params: RoutingParams;
  confidence: number; // 0..1
}

export interface RouterHomework {
  id: string;
  projectId: string;
  subject: string; // human label (the class name)
  type: string; // qcm | lesson | essay
  title: string;
}

export interface RouterContext {
  activeProjectId: string;
  projects: { id: string; name: string }[];
  homeworks: RouterHomework[];
  /** True when a lesson (or its intro dialog) is on the canvas — gates lesson-advance. */
  lessonActive: boolean;
}

const FREE_FORM: RoutingDecision = { intent: "free-form", params: {}, confidence: 1 };

// ── Fast offline heuristic ────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

const AFFIRM_RE =
  /^(yes|yeah|yep|yup|ok|okay|sure|continue|next|go on|carry on|keep going|i understand|understood|got it|makes sense|move on|proceed|right|do it)\b/;
const SWITCH_RE = /\b(switch|change|jump)\b/;
const MAIL_RE = /\b(send|email|mail|submit|forward)\b/;
const OVERVIEW_RE = /\b(today|todo|tasks?|overview|agenda|schedule|my day)\b/;
const TODO_QUESTION_RE = /\bwhat\b.*\b(do|need|have)\b/;
const HOMEWORK_RE =
  /\b(quiz|qcm|test|homework|exercise|lesson|start|continue|resume|do|work|working|revise|study|finish|open)\b/;

/** Resolve a class id mentioned in the text (handles the math/maths alias). */
function findProject(lower: string, ctx: RouterContext): string | null {
  for (const p of ctx.projects) {
    if (lower.includes(p.id) || lower.includes(p.name.toLowerCase())) return p.id;
  }
  if (/\bmath(s)?\b/.test(lower)) {
    const m = ctx.projects.find((p) => p.id === "maths");
    if (m) return m.id;
  }
  return null;
}

/** The interactive (qcm/lesson) homework for a class, if any. */
function interactiveHw(projectId: string, ctx: RouterContext): RouterHomework | undefined {
  return ctx.homeworks.find(
    (h) => h.projectId === projectId && (h.type === "qcm" || h.type === "lesson"),
  );
}

function decide(intent: Intent, params: RoutingParams, confidence = 0.9): RoutingDecision {
  return { intent, params, confidence };
}

function fastRoute(utterance: string, ctx: RouterContext): RoutingDecision | null {
  const lower = norm(utterance);
  if (!lower) return null;

  // lesson-advance — only when a lesson is active and the utterance is an affirmation.
  if (ctx.lessonActive && AFFIRM_RE.test(lower)) {
    return decide("lesson-advance", {});
  }

  const pid = findProject(lower, ctx);

  // switch-project — explicit switch verb + a class token, with no homework intent.
  if (SWITCH_RE.test(lower) && pid && !HOMEWORK_RE.test(lower)) {
    return decide("switch-project", { projectId: pid });
  }

  // open-homework — class token + a homework/action word → that class's interactive homework.
  if (pid && HOMEWORK_RE.test(lower)) {
    const hw = interactiveHw(pid, ctx);
    if (hw) return decide("open-homework", { projectId: hw.projectId, homeworkId: hw.id });
  }

  // open-homework — title keyword hints (e.g. "pythagoras") even without an explicit class name.
  for (const h of ctx.homeworks) {
    if (h.type !== "qcm" && h.type !== "lesson") continue;
    const words = norm(h.title)
      .split(" ")
      .filter((w) => w.length >= 4 && !["lesson", "essay", "homework", "quiz"].includes(w));
    if (words.some((w) => lower.includes(w))) {
      return decide("open-homework", { projectId: h.projectId, homeworkId: h.id });
    }
  }

  // compose-mail — a send verb plus something to send / a recipient.
  if (MAIL_RE.test(lower) && /\b(teacher|work|homework|this|it|submission|qcm|quiz|email|mail)\b/.test(lower)) {
    return decide("compose-mail", { projectId: pid ?? ctx.activeProjectId });
  }

  // show-todo — "what do I need to do", "today", "my tasks", …
  if (OVERVIEW_RE.test(lower) || TODO_QUESTION_RE.test(lower)) {
    return decide("show-todo", {});
  }

  return null;
}

// ── Semantic Haiku route ──────────────────────────────────────────────────────

const ROUTER_SYSTEM =
  "You are the Intent Router for a voice-controlled school assistant. Use judgment (not exact " +
  "string matching) to map the user's utterance to EXACTLY ONE intent. Reply with ONLY a compact " +
  "JSON object — no prose, no markdown fences.\n\n" +
  "Intents:\n" +
  "- show-todo — see what they have to do / their tasks / what's due / an overview.\n" +
  '- open-homework — open or continue a specific homework. Include "projectId" and "homeworkId".\n' +
  '- compose-mail — send / email / submit their work to a teacher. Include "projectId" (the teacher is inferred from it).\n' +
  '- switch-project — switch class. Include "projectId" (history|maths|english).\n' +
  '- lesson-advance — affirmations like "yes", "ok", "continue", "next", "I understand". ONLY valid when a lesson is currently active.\n' +
  "- free-form — anything else: questions, conversation, or anything unrelated to a specific feature.\n\n" +
  'Always include "confidence" (0..1). If unsure, use a low confidence and prefer free-form.\n' +
  'Reply exactly like {"intent":"open-homework","projectId":"history","homeworkId":"hw-ww2-qcm","confidence":0.9}.';

interface RawDecision {
  intent?: string;
  projectId?: string;
  homeworkId?: string;
  confidence?: number;
}

const INTENTS: ReadonlySet<string> = new Set<Intent>([
  "show-todo",
  "open-homework",
  "compose-mail",
  "switch-project",
  "lesson-advance",
  "free-form",
]);

function parseDecision(text: string, ctx: RouterContext): RoutingDecision {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return FREE_FORM;
  let obj: RawDecision;
  try {
    obj = JSON.parse(m[0]) as RawDecision;
  } catch {
    return FREE_FORM;
  }

  const intent = obj.intent ?? "";
  if (!INTENTS.has(intent)) return FREE_FORM;

  const confidence = typeof obj.confidence === "number" ? Math.max(0, Math.min(1, obj.confidence)) : 0.7;
  // Below threshold → treat as uncertain and let the main AI loop handle it.
  if (confidence < CONFIDENCE_THRESHOLD) return FREE_FORM;

  switch (intent as Intent) {
    case "show-todo":
      return { intent: "show-todo", params: {}, confidence };
    case "open-homework": {
      const hw =
        ctx.homeworks.find((h) => h.id === obj.homeworkId) ??
        (obj.projectId ? interactiveHw(obj.projectId, ctx) : undefined);
      if (!hw || (hw.type !== "qcm" && hw.type !== "lesson")) return FREE_FORM;
      return {
        intent: "open-homework",
        params: { projectId: hw.projectId, homeworkId: hw.id },
        confidence,
      };
    }
    case "compose-mail": {
      const pid = ctx.projects.some((p) => p.id === obj.projectId) ? obj.projectId! : ctx.activeProjectId;
      return { intent: "compose-mail", params: { projectId: pid }, confidence };
    }
    case "switch-project": {
      if (!ctx.projects.some((p) => p.id === obj.projectId)) return FREE_FORM;
      return { intent: "switch-project", params: { projectId: obj.projectId! }, confidence };
    }
    case "lesson-advance":
      // Guard: never advance a lesson that isn't active, even if the model says so.
      if (!ctx.lessonActive) return FREE_FORM;
      return { intent: "lesson-advance", params: {}, confidence };
    default:
      return FREE_FORM;
  }
}

async function aiRoute(
  utterance: string,
  ctx: RouterContext,
  timeoutMs: number,
): Promise<RoutingDecision> {
  if (!hasApiKey) return FREE_FORM;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const hwList = ctx.homeworks
      .map((h) => `- homeworkId="${h.id}" class="${h.projectId}" type=${h.type} title="${h.title}"`)
      .join("\n");
    const { text } = await generateText({
      model: anthropic(ROUTER_MODEL),
      temperature: 0,
      maxOutputTokens: 80,
      system: ROUTER_SYSTEM,
      prompt:
        `Homeworks:\n${hwList}\n` +
        `Active class: ${ctx.activeProjectId}\n` +
        `Lesson active: ${ctx.lessonActive ? "yes" : "no"}\n\n` +
        `User said: "${utterance}"\n\nJSON:`,
      abortSignal: ctrl.signal,
    });
    return parseDecision(text, ctx);
  } catch {
    return FREE_FORM;
  } finally {
    clearTimeout(timer);
  }
}

// ── Public entry ──────────────────────────────────────────────────────────────

/**
 * Route an utterance to an intent. Tries the instant offline heuristic first,
 * then a fast Haiku classification; defaults to `free-form` on
 * miss / low-confidence / timeout / error.
 */
export async function routeIntent(
  utterance: string,
  ctx: RouterContext,
  timeoutMs = 2500,
): Promise<RoutingDecision> {
  if (!utterance.trim()) return FREE_FORM;
  const fast = fastRoute(utterance, ctx);
  if (fast) return fast;
  return aiRoute(utterance, ctx, timeoutMs);
}
