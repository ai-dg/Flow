/**
 * Demo Store — state machine for the scripted school demo.
 *
 * The scripted school flow does NOT go through Claude. Each step's `onEnter()`
 * spawns pre-authored widgets directly via the canvas store and narrates a line
 * through the injected TTS narrator. The Simulate-Voice button calls advance();
 * Reset Demo calls reset(). Stateful widgets (QCM, mail, dialog) call back into
 * the store (onQCMComplete / onMailSent / handleDialogAction) to gate progress.
 *
 * Widget data is pulled from the project store (single source of truth —
 * schoolData.ts) rather than hardcoded here, so progress is always computed.
 *
 * See .claude/docs/DEMO_SCRIPT.md and BUILD_PLAN.md (Phase 3).
 */

import { create } from "zustand";
import { useCanvasStore } from "@/store/canvasStore";
import { useProjectStore, type Project } from "@/projects/projectStore";
import {
  computeProgress,
  type QCMData,
  type LessonData,
} from "@/projects/schoolData";

// ─── Narrator injection ───────────────────────────────────────────────────────
//
// The TTS service lives in App.tsx (ttsRef). App registers a narrator here on
// mount so scripted steps can speak + show text through the same path as live
// mode. Defaults to a no-op so the store works headless (tests / SSR).

type Narrator = (text: string) => void;
let narrate: Narrator = () => {};

/** App registers the TTS+ResponseBox narrator. Pass "" to clear the display. */
export function setDemoNarrator(fn: Narrator): void {
  narrate = fn;
}

// ─── Step model ───────────────────────────────────────────────────────────────

interface DemoStep {
  /** Phrase shown on the Simulate-Voice button that TRIGGERS entering this step. */
  label: string | null;
  /** If true, the voice button hides on entry and is re-shown by a callback. */
  gated?: boolean;
  onEnter: () => void;
}

// ─── Widget-data builders (pull from project store) ───────────────────────────

const SUBJECT_ICON: Record<string, string> = {
  history: "📚",
  maths: "📐",
  english: "📝",
};

/** Build a `task-list` widget payload from a project (progress is computed). */
function taskWidgetData(project: Project) {
  return {
    subject: project.name,
    icon: SUBJECT_ICON[project.id] ?? "📘",
    teacher: project.teacher.name,
    tasks: project.homeworks.map((h) => ({
      title: h.title,
      type: h.type,
      progress: computeProgress(h),
      dueLabel: h.dueLabel,
      urgent: h.dueDate === "today",
    })),
  };
}

const canvas = () => useCanvasStore.getState();
const store = () => useProjectStore.getState();

// ─── Demo steps ───────────────────────────────────────────────────────────────

const DEMO_STEPS: DemoStep[] = [
  // Step 0 — black screen (reset target).
  {
    label: null,
    onEnter: () => {
      canvas().clear();
      narrate("");
    },
  },

  // Step 1 — "What do I need to do today?" → three task overview cards.
  {
    label: '🎤 "What do I need to do today?"',
    onEnter: () => {
      narrate("Good morning, Alex. Here's where you're at today.");
      const { projects } = store();
      const layout = [
        { id: "task-history", proj: projects.history, x: 8 },
        { id: "task-maths", proj: projects.maths, x: 37 },
        { id: "task-english", proj: projects.english, x: 66 },
      ];
      layout.forEach((c, i) => {
        if (!c.proj) return;
        window.setTimeout(() => {
          canvas().spawn({
            id: c.id,
            type: "task-list",
            x: c.x,
            y: 18,
            w: 26,
            h: 42,
            data: taskWidgetData(c.proj),
          });
        }, i * 80);
      });
    },
  },

  // Step 2 — "Let's start with the History homework…" → QCM (gated by submit).
  {
    label: '🎤 "Let\'s start with the History homework we started yesterday"',
    gated: true,
    onEnter: () => {
      store().setActiveProject("history"); // clears canvas, sets HISTORY label
      narrate("Picking up where you left off. Question 4 of 7.");
      const hw = store().projects.history?.homeworks[0]?.data as QCMData | undefined;
      if (!hw) return;
      canvas().spawn({
        id: "qcm-ww2",
        type: "qcm",
        x: 12,
        y: 12,
        w: 76,
        h: 76,
        data: {
          subject: hw.subject,
          totalQuestions: hw.questions.length,
          startAtQuestion: Object.keys(hw.answers).length,
          preAnswered: hw.answers,
          questions: hw.questions,
        },
      });
    },
  },

  // Step 3a — "Could you send this work to my teacher?" → mail compose.
  {
    label: '🎤 "Could you send this work to my teacher?"',
    onEnter: () => {
      canvas().despawn("qcm-ww2");
      const teacher = store().projects.history?.teacher;
      narrate("Preparing your submission for Ms. Martin. Ready to send — shall I go ahead?");
      canvas().spawn({
        id: "mail-compose",
        type: "mail-compose",
        x: 22,
        y: 12,
        w: 56,
        h: 60,
        data: {
          to: { name: teacher?.name ?? "Ms. Martin", email: teacher?.email ?? "" },
          subject: "WW2 QCM — Alex Dupont",
          body:
            "Dear Ms. Martin,\n\n" +
            "Please find attached my completed QCM on World War 2.\n" +
            "All 7 questions answered.\n\n" +
            "Best regards,\nAlex",
          attachments: [
            { name: "WW2_QCM_Alex_Dupont.pdf", type: "qcm", sourceWidgetId: "qcm-ww2" },
          ],
          readyToSend: true,
        },
      });
    },
  },

  // Step 3b — "Yes, send it" → mail sent + confirmation.
  {
    label: '🎤 "Yes, send it"',
    onEnter: () => {
      canvas().despawn("mail-compose");
      narrate("Sent. Ms. Martin will receive it shortly. Your WW2 QCM has been submitted.");
    },
  },

  // Step 4 — "Let's start the Maths lesson on Pythagoras" → confirmation dialog.
  {
    label: '🎤 "Let\'s start the Maths lesson on Pythagoras"',
    onEnter: () => {
      store().setActiveProject("maths"); // clears canvas, sets MATHS label
      narrate("Starting Pythagoras Theorem. Want a quick visual walkthrough first?");
      canvas().spawn({
        id: "maths-dialog",
        type: "dialog",
        x: 28,
        y: 30,
        w: 44,
        h: 30,
        data: {
          title: "Pythagoras Theorem",
          icon: "📐",
          body: "Want a quick visual walkthrough of the theorem before we begin?",
          actions: [
            { label: "Skip", action: "skip-lesson" },
            { label: "Yes, show me", action: "start-lesson", primary: true },
          ],
        },
      });
    },
  },

  // Step 5–8 — "Yes, show me" → interactive lesson (beats advance inside widget).
  {
    label: '🎤 "Yes, show me"',
    onEnter: () => {
      canvas().despawn("maths-dialog");
      const hw = store().projects.maths?.homeworks[0]?.data as LessonData | undefined;
      narrate("Let's build it up piece by piece.");
      if (!hw) return;
      canvas().spawn({
        id: "lesson-pythagoras",
        type: "lesson",
        x: 8,
        y: 10,
        w: 84,
        h: 80,
        data: {
          subject: hw.subject,
          currentBeat: hw.currentBeat,
          beats: hw.beats,
          projectId: "maths",
          homeworkId: "hw-pythagoras",
        },
      });
    },
  },
];

/** Last index — the lesson step. Shown as `n / TOTAL_STEPS` in DemoControls. */
export const TOTAL_STEPS = DEMO_STEPS.length - 1;

/** Voice label after entering step `i` (null while gated or at the end). */
function labelAfter(i: number): string | null {
  if (DEMO_STEPS[i]?.gated) return null;
  return DEMO_STEPS[i + 1]?.label ?? null;
}

// ─── Store ──────────────────────────────────────────────────────────────────

export interface DemoState {
  /** Current step index, 0–TOTAL_STEPS. */
  currentStep: number;
  /** Label on the voice-simulation button, or null when hidden. */
  voiceButtonLabel: string | null;
  /** True once the final (lesson) step is reached. */
  isComplete: boolean;

  /** Advance to the next step (runs that step's onEnter). */
  advance: () => void;
  /** Return to step 0 with a clean canvas and fresh school data. */
  reset: () => void;

  /** QCM submit callback — persists answers and re-shows the next voice button. */
  onQCMComplete: (answers: Record<number, number>) => void;
  /** Mail-compose send callback — advances to the sent-confirmation step. */
  onMailSent: () => void;
  /** Dialog yes/no callback — starts or skips the lesson. */
  handleDialogAction: (action: string) => void;
}

export const useDemoStore = create<DemoState>((set, get) => ({
  currentStep: 0,
  voiceButtonLabel: DEMO_STEPS[1]?.label ?? null,
  isComplete: false,

  advance: () => {
    const next = get().currentStep + 1;
    const step = DEMO_STEPS[next];
    if (!step) return; // already at the end
    step.onEnter();
    set({
      currentStep: next,
      voiceButtonLabel: labelAfter(next),
      isComplete: next >= DEMO_STEPS.length - 1,
    });
  },

  reset: () => {
    useProjectStore.getState().reset(); // fresh school data + clears canvas/tree
    DEMO_STEPS[0].onEnter();
    set({
      currentStep: 0,
      voiceButtonLabel: DEMO_STEPS[1]?.label ?? null,
      isComplete: false,
    });
  },

  onQCMComplete: (answers) => {
    // Persist the student's answers back to the history homework (single source
    // of truth) so any later progress read reflects the completed quiz.
    useProjectStore.getState().updateHomeworkData("history", "hw-ww2-qcm", { answers });
    if (get().currentStep !== 2) return;
    set({ voiceButtonLabel: DEMO_STEPS[3]?.label ?? null });
  },

  onMailSent: () => {
    if (get().currentStep === 3) get().advance();
  },

  handleDialogAction: (action) => {
    if (action === "start-lesson") {
      get().advance();
    } else if (action === "skip-lesson") {
      narrate("No problem — the lesson is saved to your Maths folder.");
      set({ voiceButtonLabel: null, isComplete: true });
    }
  },
}));
