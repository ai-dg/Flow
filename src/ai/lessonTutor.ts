/**
 * Lesson Tutor — the conversational brain of the interactive lesson.
 *
 * The lesson delivers ONE idea per turn and waits. Every student turn during the
 * lesson — a question, "I don't get it", or an affirmation — comes here, and the
 * agent picks ONE of four responses:
 *
 *   - `deepen`  — a follow-up / "more detail": go one level further on the current
 *     concept, using a DIFFERENT representation than last time (visual → numeric
 *     example, definition → analogy, …). Does not advance.
 *   - `reframe` — confusion: explain the SAME concept from a completely different
 *     angle (an approach not used yet), acknowledging the confusion without being
 *     condescending. Does not advance.
 *   - `advance` — a clear "yes / I understand": briefly validate, then the
 *     orchestrator introduces the next idea (slowly, one idea).
 *   - `clarify` — ambiguous input, silence, or a vague "ok": ask one focused
 *     question before moving on. The agent NEVER advances just because the student
 *     said nothing negative — a weak signal is checked, not assumed.
 *
 * ── Pacing constraints (slower, deliberate delivery) ─────────────────────────
 * The system prompt enforces: at most ONE new concept per turn; always end a turn
 * on a check-in question or invitation to continue (never a bare statement); and
 * vary vocabulary across turns on the same concept. The end-on-a-hook rule is also
 * guarded deterministically (`ensureHook`) so even a fallback reply keeps the hook.
 * Rendering paces with speech in LessonSVGCanvas (only the current concept is fully
 * lit; earlier ones recede; future ones are never pre-drawn).
 *
 * ── Comprehension state (lives in session context, not a DB) ──────────────────
 * The agent is handed a `ComprehensionState` for the current topic on every turn.
 * It reads it (to pick a fresh approach, to recognise a follow-up as part of the
 * same topic) and returns the UPDATED state alongside its reply; the orchestrator
 * (`demoStore`) saves it and passes it back next turn. The Intent Router signals a
 * topic switch, on which the orchestrator clears the state (`freshComprehension`).
 *
 * To keep the bookkeeping reliable, the state is updated deterministically here
 * (`applyTurn`) from the model's decision (mode + chosen approach) layered onto the
 * previous state — the model owns the hard part (what to say, which unused approach
 * to use); this wrapper owns the invariants. A deterministic offline fallback (the
 * beat's authored `reframe`/`deepen` text) keeps the lesson alive with no API key /
 * on timeout / error, so the demo can never stall (CLAUDE.md rule #1).
 *
 * See .claude/docs/AI_CONTRACT.md → Lesson Tutor and DEMO_SCRIPT.md → maths-lesson.
 */

import { generateText } from "ai";
import { anthropic, hasApiKey, MODEL } from "./client";
import type { LessonConcept, ExplanationApproach } from "@/projects/schoolData";

export type { ExplanationApproach };

/**
 * The tutor's four responses to a student turn:
 * - `deepen`  — a follow-up / "more detail": go one level further on the current
 *   concept, using a DIFFERENT representation than last time.
 * - `reframe` — confusion: don't advance; explain the SAME concept from a completely
 *   different angle, acknowledging the confusion ("Let me try a different way.").
 * - `advance` — a clear "yes / I understand": briefly validate, then introduce the
 *   next concept slowly as a single idea.
 * - `clarify` — ambiguous input, silence, or a vague "ok" (a weak signal): ask one
 *   focused question before moving on rather than assuming understanding.
 */
export type TutorMode = "deepen" | "reframe" | "advance" | "clarify";

/** Whether the student has signalled understanding of a concept. */
export type ConceptStatus = "confirmed" | "confused" | "no-signal";

export interface ConceptState {
  concept: string;
  status: ConceptStatus;
  /** Every approach used so far on this concept (so a reframe can pick an unused one). */
  approaches: ExplanationApproach[];
  /** The approach used most recently. */
  lastApproach: ExplanationApproach | null;
}

export interface TutorExchange {
  role: "tutor" | "student";
  text: string;
}

/**
 * The tutor's working model of the student for ONE topic. Session-only — held in
 * `demoStore.comprehension`, never persisted, and cleared on a topic switch.
 */
export interface ComprehensionState {
  /** The topic this state belongs to (e.g. "Pythagoras Theorem"). */
  topic: string;
  /** The concept currently being taught (replaces the old linear beat index). */
  activeConcept: string;
  /** Concepts introduced in this topic, in introduction order. */
  concepts: ConceptState[];
  /** Specific sub-questions the student has asked about this topic. */
  subQuestions: string[];
  /** Recent turns, capped — supporting context so the tutor deepens rather than restarts. */
  exchanges: TutorExchange[];
}

export interface TutorReply {
  mode: TutorMode;
  /** The explanation approach this reply used. */
  approach: ExplanationApproach;
  /** What the tutor speaks — 1–2 short sentences, ending with an invitation to react. */
  say: string;
  /** The comprehension state AFTER this turn — the orchestrator saves this. */
  state: ComprehensionState;
}

export interface TutorInput {
  /** The active concept (from the concept library) the student is reacting to. */
  concept: LessonConcept;
  state: ComprehensionState;
  utterance: string;
}

const APPROACHES: readonly ExplanationApproach[] = ["visual", "analogy", "example", "formal"];

// ── State constructors / pure updates (shared with the orchestrator) ───────────

/** A clean comprehension state for the start of a topic (or after a topic switch). */
export function freshComprehension(topic: string): ComprehensionState {
  return { topic, activeConcept: "", concepts: [], subQuestions: [], exchanges: [] };
}

function find(state: ComprehensionState, concept: string): ConceptState | undefined {
  return state.concepts.find((c) => c.concept === concept);
}

/**
 * Record that a concept has been introduced and make it the active concept. If it
 * was already introduced (e.g. revisited), it just becomes active again.
 */
export function introduceConcept(
  state: ComprehensionState,
  concept: string | undefined,
  approach: ExplanationApproach,
): ComprehensionState {
  if (!concept) return state;
  if (find(state, concept)) return { ...state, activeConcept: concept };
  return {
    ...state,
    activeConcept: concept,
    concepts: [
      ...state.concepts,
      { concept, status: "no-signal", approaches: [approach], lastApproach: approach },
    ],
  };
}

/** Mark a concept confirmed (the student affirmed / advanced past it). */
export function confirmConcept(state: ComprehensionState, concept: string | undefined): ComprehensionState {
  if (!concept) return state;
  return {
    ...state,
    concepts: state.concepts.map((c) => (c.concept === concept ? { ...c, status: "confirmed" } : c)),
  };
}

/**
 * Pick a representation DIFFERENT from last time for the current concept: prefer an
 * available approach not used yet; otherwise just differ from the last one. Used for
 * both `reframe` and `deepen` so an explanation never repeats the same representation.
 * `available` is the set of approaches the concept actually has in its library.
 */
export function differentApproach(
  used: ExplanationApproach[],
  last: ExplanationApproach | null,
  available: readonly ExplanationApproach[] = APPROACHES,
): ExplanationApproach {
  const pool = available.length ? available : APPROACHES;
  const unused = pool.find((a) => !used.includes(a));
  if (unused) return unused;
  return pool.find((a) => a !== last) ?? pool[0] ?? "example";
}

interface Turn {
  mode: TutorMode;
  approach: ExplanationApproach;
  utterance: string;
  say: string;
}

/**
 * Apply a student↔tutor turn to the comprehension state: update the current
 * concept's status + approaches, record a sub-question on a follow-up, and append
 * the exchange. The single source of truth for how the state evolves.
 *
 * Only the explanatory modes (`deepen`/`reframe`) record an approach — they tried a
 * representation on this concept. Both `advance` (a clear "yes") and `deepen` (a
 * meaningful follow-up) are comprehension signals → status `confirmed`; `reframe` is
 * confusion; `clarify` (a weak signal) changes nothing but the exchange.
 */
export function applyTurn(state: ComprehensionState, conceptName: string, turn: Turn): ComprehensionState {
  const existing = find(state, conceptName);
  const explanatory = turn.mode === "deepen" || turn.mode === "reframe";

  const nextStatus = (s: ConceptStatus): ConceptStatus =>
    turn.mode === "reframe"
      ? "confused"
      : turn.mode === "advance" || turn.mode === "deepen"
        ? "confirmed"
        : s;

  const updatedConcept = (c: ConceptState): ConceptState => ({
    ...c,
    status: nextStatus(c.status),
    approaches:
      explanatory && !c.approaches.includes(turn.approach) ? [...c.approaches, turn.approach] : c.approaches,
    lastApproach: explanatory ? turn.approach : c.lastApproach,
  });

  const concepts = existing
    ? state.concepts.map((c) => (c.concept === conceptName ? updatedConcept(c) : c))
    : [
        ...state.concepts,
        updatedConcept({ concept: conceptName, status: "no-signal", approaches: [], lastApproach: null }),
      ];

  const subQuestions =
    turn.mode === "deepen" && turn.utterance.trim()
      ? [...state.subQuestions, turn.utterance.trim()].slice(-12)
      : state.subQuestions;

  const exchanges = [
    ...state.exchanges,
    { role: "student" as const, text: turn.utterance },
    { role: "tutor" as const, text: turn.say },
  ].slice(-10);

  return { ...state, concepts, subQuestions, exchanges };
}

// ── Offline classifier + safety net (no-key / error path) ──────────────────────

const CONFUSED_RE =
  /\b(don'?t|do not|didn'?t|did not)\b.*\b(get|understand|follow|see)\b|\b(confus|lost|no idea|not sure|unclear|makes no sense|what do you mean|huh|stuck|again)\b|^(what|sorry|wait)\??$/i;

// A question or an explicit request to go further on the current idea.
const QUESTION_RE =
  /\?|^(why|how|what|when|where|which|who|does|do|can|could|is|are)\b|\b(tell me more|more detail|explain|example|for instance|go deeper|what about|what if)\b/i;

// A clear, confident "I understand" or an explicit request to move on.
const STRONG_AFFIRM_RE =
  /\b(i (understand|get it|got it|see)|understood|makes sense|that makes sense|crystal clear|i'?m with you|perfectly clear|next|move on|carry on|go on|keep going|continue|i'?m good)\b/i;

// A bare / hedged acknowledgement — a WEAK signal, not a confirmation.
const WEAK_AFFIRM_RE =
  /^(ok(ay)?|sure|fine|alright|right|yeah?|yep|yup|yes|mm+|mhm|uh ?huh|i guess|i think so|maybe|kind of|kinda|sort of|sorta|cool)\b/i;

/**
 * Best-effort offline classification into the four modes. The key rule: a weak or
 * absent signal (silence, a bare "ok") becomes `clarify`, never `advance`.
 */
function classify(utterance: string): TutorMode {
  const t = utterance.trim();
  if (!t) return "clarify"; // silence → check, never auto-advance
  if (CONFUSED_RE.test(t)) return "reframe";
  if (QUESTION_RE.test(t)) return "deepen";
  if (STRONG_AFFIRM_RE.test(t)) return "advance";
  if (WEAK_AFFIRM_RE.test(t)) return "clarify"; // vague "ok" → check before moving on
  return "clarify"; // anything ambiguous → clarify
}

/** True if the text already ends on a follow-up hook (a question). */
function endsWithHook(say: string): boolean {
  return /\?["')]?\s*$/.test(say.trim());
}

/**
 * Enforce the pacing rule "always end a concept turn with a check-in or invitation,
 * never on a bare statement" by appending a hook when one is missing. `advance` is
 * exempt — its hook comes from the next idea the orchestrator appends.
 */
function ensureHook(say: string, mode: TutorMode): string {
  if (mode === "advance" || endsWithHook(say)) return say;
  const t = say.trim();
  const base = /[.!?]$/.test(t) ? t : `${t}.`;
  const hook =
    mode === "reframe"
      ? "Does that make more sense?"
      : mode === "deepen"
        ? "Want me to go further, or shall we move on?"
        : "Shall I go on?";
  return `${base} ${hook}`;
}

/** The approaches a concept actually has in its library. */
function availableApproaches(concept: LessonConcept): ExplanationApproach[] {
  return concept.explanations.map((e) => e.approach);
}

/** The authored explanation for an approach (the offline text the tutor reaches for). */
function explanationFor(concept: LessonConcept, approach: ExplanationApproach): string | undefined {
  return concept.explanations.find((e) => e.approach === approach)?.instruction;
}

/** Finalise a reply: enforce the end-on-a-hook rule, then fold the turn into the state. */
function build(input: TutorInput, mode: TutorMode, approach: ExplanationApproach, rawSay: string): TutorReply {
  const say = ensureHook(rawSay, mode);
  return {
    mode,
    approach,
    say,
    state: applyTurn(input.state, input.concept.concept, { mode, approach, utterance: input.utterance, say }),
  };
}

/** Deterministic reply — the no-key / error path. Selects an explanation from the library. */
function fallbackReply(input: TutorInput): TutorReply {
  const { concept, state, utterance } = input;
  const mode = classify(utterance);
  const cs = find(state, concept.concept);
  const used = cs?.approaches ?? [];
  const last = cs?.lastApproach ?? null;
  const available = availableApproaches(concept);

  let approach: ExplanationApproach;
  let say: string;
  switch (mode) {
    case "reframe":
      approach = differentApproach(used, last, available);
      say = "Let me try a different way. " + (explanationFor(concept, approach) ?? "Same idea, from another angle.");
      break;
    case "deepen":
      approach = differentApproach(used, last, available);
      say = explanationFor(concept, approach) ?? "Good question — staying on this same idea, here's a little more.";
      break;
    case "advance":
      approach = last ?? concept.introApproach;
      say = "Exactly — that's the key idea."; // the orchestrator appends the next idea
      break;
    case "clarify":
    default:
      approach = last ?? concept.introApproach;
      say = "Want me to go a bit deeper on this, or are you happy to move on?";
      break;
  }
  return build(input, mode, approach, say);
}

// ── AI path ────────────────────────────────────────────────────────────────────

const TUTOR_SYSTEM =
  "You are a patient one-on-one tutor in a live voice lesson. You teach ONE idea at a time and you " +
  "only help the student with the single concept currently on screen — never introduce a new one " +
  "yourself. You are given a comprehension state for this topic: which concepts were introduced, each " +
  "one's status (confirmed / confused / no-signal), the explanation approaches already used on each, " +
  "and the sub-questions asked. Use it.\n\n" +
  "Choose EXACTLY ONE mode from the student's latest input:\n" +
  '- "deepen": they asked a follow-up or want more detail. Go one level deeper on the SAME concept, ' +
  "using a DIFFERENT representation than last time (if you last used a visual, give a concrete numerical " +
  "example; if a definition, give an analogy). Pick an approach not already in this concept's list.\n" +
  '- "reframe": they expressed confusion / didn\'t understand. Do NOT advance. Explain the SAME concept ' +
  "from a COMPLETELY different angle (an approach not used yet) and briefly acknowledge the confusion " +
  'without condescension (e.g. "Let me try a different way."). Never repeat your earlier wording.\n' +
  '- "advance": they clearly said yes / ok / I understand. VALIDATE in one short clause (e.g. "Exactly — ' +
  "that's the key idea.\") and STOP — do not state the next concept; the app introduces it next.\n" +
  '- "clarify": the input is ambiguous, silent, or a vague "ok". Ask ONE focused question to find out ' +
  "whether they want to go deeper, move on, or explore something adjacent. NEVER advance on a weak signal " +
  "— only advance on a clear yes.\n\n" +
  'The approach is one of: "visual" (picture/drawing), "analogy" (everyday comparison), "example" ' +
  '(a worked case/numbers), "formal" (precise definition).\n\n' +
  "Pacing rules — ALWAYS:\n" +
  "1. Introduce AT MOST ONE new concept per turn. Never put two distinct concepts in one turn " +
  "(e.g. do NOT say 'a is the vertical side and b is the horizontal side' — that is two).\n" +
  "2. END your turn with a check-in question or an invitation to continue (e.g. \"Does that make " +
  'sense?", "Want me to show you why?", "Ready for the next part?"). Never end on a bare statement.\n' +
  "3. VARY your vocabulary across turns on the same concept. If you used a term last turn (see the " +
  "recent exchange), use different phrasing this turn (e.g. 'hypotenuse' → 'the long slanted side'). " +
  "Re-explaining means new words, not repetition.\n\n" +
  "Keep it to 1–2 short, spoken sentences. Reply with ONLY compact JSON, no prose, no fences: " +
  '{"mode":"deepen"|"reframe"|"advance"|"clarify","approach":"visual"|"analogy"|"example"|"formal","say":"..."}.';

interface RawReply {
  mode?: string;
  approach?: string;
  say?: string;
}

const MODES: ReadonlySet<string> = new Set<TutorMode>(["deepen", "reframe", "advance", "clarify"]);

function parse(text: string, input: TutorInput): TutorReply {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return fallbackReply(input);
  let obj: RawReply;
  try {
    obj = JSON.parse(m[0]) as RawReply;
  } catch {
    return fallbackReply(input);
  }
  const say = typeof obj.say === "string" ? obj.say.trim() : "";
  if (!say) return fallbackReply(input);

  const mode: TutorMode = MODES.has(obj.mode ?? "") ? (obj.mode as TutorMode) : classify(input.utterance);

  const cs = find(input.state, input.concept.concept);
  const used = cs?.approaches ?? [];
  const last = cs?.lastApproach ?? null;
  const available = availableApproaches(input.concept);
  const claimed = APPROACHES.find((a) => a === obj.approach);

  let approach: ExplanationApproach;
  if (mode === "deepen" || mode === "reframe") {
    // Must differ from last time (and, for a reframe, be genuinely unused). Honour
    // the model's choice only when it's fresh; otherwise pick a different one.
    const fresh = !!claimed && claimed !== last && !(mode === "reframe" && used.includes(claimed));
    approach = fresh ? (claimed as ExplanationApproach) : differentApproach(used, last, available);
  } else {
    approach = claimed ?? last ?? input.concept.introApproach;
  }

  return build(input, mode, approach, say);
}

/**
 * Decide the tutor's response to a student turn (deepen / reframe / advance /
 * clarify) and return the updated comprehension state. The tutor itself never
 * mutates the lesson position — on `advance` the orchestrator steps to the next
 * idea. Falls back to a deterministic reply on no-key / timeout / error.
 */
export async function runLessonTutor(input: TutorInput, timeoutMs = 6000): Promise<TutorReply> {
  if (!hasApiKey) return fallbackReply(input);

  const { concept, state, utterance } = input;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const recent = state.exchanges
      .slice(-6)
      .map((e) => `${e.role === "tutor" ? "Tutor" : "Student"}: ${e.text}`)
      .join("\n");
    const conceptLines = state.concepts
      .map(
        (c) =>
          `- ${c.concept}: ${c.status}; approaches used: ${c.approaches.length ? c.approaches.join(", ") : "none"}`,
      )
      .join("\n");
    const cs = find(state, concept.concept);
    const usedHere = cs?.approaches ?? [];
    const avail = availableApproaches(concept);
    const { text } = await generateText({
      model: anthropic(MODEL),
      temperature: 0.5,
      maxOutputTokens: 220,
      system: TUTOR_SYSTEM,
      prompt:
        `Topic: ${state.topic}\n` +
        `Active concept: "${concept.concept}"\n` +
        `Approaches available for it: ${avail.join(", ")} — already used: ${usedHere.length ? usedHere.join(", ") : "none"}\n` +
        `Comprehension state:\n${conceptLines || "- (nothing yet)"}\n` +
        `Sub-questions so far: ${state.subQuestions.length ? state.subQuestions.join(" | ") : "none"}\n` +
        (recent ? `Recent exchange:\n${recent}\n` : "") +
        `\nThe student just said: "${utterance}"\n\nJSON:`,
      abortSignal: ctrl.signal,
    });
    return parse(text, input);
  } catch {
    return fallbackReply(input);
  } finally {
    clearTimeout(timer);
  }
}
