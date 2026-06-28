/**
 * LessonWidget — interactive lesson (school demo, Step 5). A conversational tutor.
 *
 * The widget knows nothing about sequence. The store hands it a single render beat
 * (`lessonView`: one instruction for the active concept) and the comprehension state
 * (which concept is active, which are introduced, which are understood). It renders
 * "this now": the active concept's visual on the SVG (earlier concepts receded) plus
 * the instruction in the narration panel.
 *
 * Which explanation to play is the tutor's decision (deepen / reframe / advance), not
 * a position counter — see src/ai/lessonTutor.ts and demoStore.lessonRespond. The OK
 * button advances explicitly via `advanceLessonBeat`.
 *
 * See .claude/docs/WIDGETS.md → `lesson`.
 *
 * Card chrome (border / radius) is applied by `shellConfig` in Canvas.tsx; this
 * renderer fills the inner area.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import type { Widget } from "./types";
import type { LessonConcept } from "@/projects/schoolData";
import { useDemoStore } from "@/store/demoStore";
import { LessonSVGCanvas } from "./LessonSVGCanvas";
import { LessonNarration } from "./LessonNarration";

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

/** The intro explanation text for a concept (the `introApproach` variant). */
function introInstruction(concept: LessonConcept): string {
  const byApproach = concept.explanations.find((e) => e.approach === concept.introApproach);
  return (byApproach ?? concept.explanations[0])?.instruction ?? "";
}

/** Equation revealed character-by-character on the equation concept. */
function EquationReveal({ equation }: { equation: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[8%] flex justify-center">
      <div className="font-mono font-bold text-white" style={{ fontSize: 28 }}>
        {[...equation].map((ch, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.06, duration: 0.15 }}
            style={{ whiteSpace: "pre" }}
          >
            {ch}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

export function LessonWidget(w: Widget) {
  const concepts = (Array.isArray(w.data.concepts) ? w.data.concepts : []) as LessonConcept[];

  // Everything the widget renders comes from the store — it tracks no position.
  const view = useDemoStore((s) => s.lessonView);
  const active = useDemoStore((s) => s.comprehension.activeConcept);
  const conceptStates = useDemoStore((s) => s.comprehension.concepts);
  const onOK = useDemoStore((s) => s.advanceLessonBeat);

  const introduced = useMemo(() => conceptStates.map((c) => c.concept), [conceptStates]);
  const understood = useMemo(
    () => conceptStates.filter((c) => c.status === "confirmed").map((c) => c.concept),
    [conceptStates],
  );
  const struggling = useMemo(
    () => conceptStates.filter((c) => c.status === "confused").map((c) => c.concept),
    [conceptStates],
  );

  const activeIdx = concepts.findIndex((c) => c.concept === active);
  const activeConcept = activeIdx >= 0 ? concepts[activeIdx] : concepts[0];
  const isLast = activeIdx === concepts.length - 1;

  const isEquation = activeConcept?.visual.type === "equation";
  const equationConcept = concepts.find((c) => c.visual.type === "equation");
  const showEquation = isEquation && !!equationConcept?.visual.equation;

  // The render beat: the instruction the store handed us, falling back to the active
  // concept's intro (e.g. on first paint before the store has set a view).
  const instruction = view?.instruction || (activeConcept ? introInstruction(activeConcept) : "");

  return (
    // stopPropagation so OK clicks don't trigger the canvas zoom handler.
    <div className="flex h-full" onClick={(e) => e.stopPropagation()}>
      {/* Left 65% — SVG drawing canvas */}
      <div className="relative h-full w-[65%] border-r border-white/10">
        <LessonSVGCanvas concepts={concepts} introduced={introduced} active={active} />
        {showEquation && <EquationReveal equation={str(equationConcept?.visual.equation)} />}
      </div>

      {/* Right 35% — narration panel */}
      <div className="h-full w-[35%]">
        <LessonNarration
          instruction={instruction}
          understood={understood}
          struggling={struggling}
          showOK={!isEquation && !isLast && activeIdx >= 0}
          complete={isLast && activeIdx >= 0}
          onOK={onOK}
        />
      </div>
    </div>
  );
}
