/**
 * LessonWidget — interactive lesson (school demo, Step 5). Drives the
 * Pythagoras walkthrough: JARVIS "draws" on an SVG canvas while narrating beat
 * by beat, pausing at each segment for the student's OK confirmation.
 *
 * Layout: left 65% SVG drawing canvas, right 35% narration panel. The widget
 * owns its own beat index (seeded from `data.currentBeat`); each OK advances one
 * beat and persists progress to the project store. The final (equation) beat has
 * no OK — it reveals the equation and a "Lesson complete" badge.
 *
 * See .claude/docs/WIDGETS.md → `lesson`.
 *
 * Card chrome (border / radius) is applied by `shellConfig` in Canvas.tsx; this
 * renderer fills the inner area.
 */

import { useState } from "react";
import { motion } from "framer-motion";
import type { Widget } from "./types";
import type { LessonBeat } from "@/projects/schoolData";
import { useProjectStore } from "@/projects/projectStore";
import { LessonSVGCanvas } from "./LessonSVGCanvas";
import { LessonNarration } from "./LessonNarration";

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

/** Equation revealed character-by-character on the final beat. */
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
  const beats = (Array.isArray(w.data.beats) ? w.data.beats : []) as LessonBeat[];
  const projectId = str(w.data.projectId);
  const homeworkId = str(w.data.homeworkId);

  const seed = Math.max(0, Math.min(num(w.data.currentBeat, 0), Math.max(0, beats.length - 1)));
  const [beat, setBeat] = useState(seed);

  const current = beats[beat];
  const isEquation = current?.type === "equation";
  const equationBeat = beats.find((b) => b.type === "equation");
  // Equation overlay shows once the student has reached the equation beat.
  const showEquation = isEquation && !!equationBeat?.equation;

  const onOK = () => {
    if (beat >= beats.length - 1) return;
    const next = beat + 1;
    setBeat(next);
    if (projectId && homeworkId) {
      useProjectStore.getState().updateHomeworkData(projectId, homeworkId, { currentBeat: next });
    }
  };

  return (
    // stopPropagation so OK clicks don't trigger the canvas zoom handler.
    <div className="flex h-full" onClick={(e) => e.stopPropagation()}>
      {/* Left 65% — SVG drawing canvas */}
      <div className="relative h-full w-[65%] border-r border-white/10">
        <LessonSVGCanvas beats={beats} currentBeat={beat} />
        {showEquation && <EquationReveal equation={str(equationBeat?.equation)} />}
      </div>

      {/* Right 35% — narration panel */}
      <div className="h-full w-[35%]">
        <LessonNarration
          instruction={str(current?.instruction)}
          showOK={!isEquation && beat < beats.length - 1}
          complete={isEquation}
          onOK={onOK}
        />
      </div>
    </div>
  );
}
