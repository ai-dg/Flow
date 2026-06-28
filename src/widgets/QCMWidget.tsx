/**
 * QCMWidget — interactive multiple-choice quiz (school demo, Step 2).
 *
 * Fills most of the canvas. Starts mid-quiz (`startAtQuestion`) with the
 * already-answered questions seeded from `preAnswered`. Selecting an option
 * confirms it immediately and reveals correct/wrong feedback; Next walks
 * forward and becomes Submit on the final question.
 *
 * On Submit → `useDemoStore.getState().onQCMComplete(answers)`.
 * See .claude/docs/WIDGETS.md → `qcm`.
 *
 * Card chrome (bg / border / radius) is applied by `shellConfig` in Canvas.tsx;
 * this renderer fills the inner area and owns its own padding.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Widget } from "./types";
import { useDemoStore } from "@/store/demoStore";

interface QCMQuestion {
  text: string;
  imagePlaceholder?: string;
  options: string[];
  correctIndex: number;
}

type OptState = "idle" | "selected" | "correct" | "wrong" | "reveal";

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function num(v: unknown, fb = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fb;
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

const OPTION_STYLE: Record<OptState, React.CSSProperties> = {
  idle: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.07)",
  },
  selected: {
    background: "rgba(99,102,241,0.15)",
    border: "1px solid rgba(99,102,241,0.4)",
  },
  correct: {
    background: "rgba(52,211,153,0.15)",
    border: "1px solid #34d399",
  },
  reveal: {
    background: "rgba(52,211,153,0.15)",
    border: "1px solid #34d399",
  },
  wrong: {
    background: "rgba(239,68,68,0.15)",
    border: "1px solid #ef4444",
  },
};

function OptionRow({ label, index, state }: { label: string; index: number; state: OptState }) {
  const icon = state === "correct" || state === "reveal" ? "✓" : state === "wrong" ? "✗" : "";
  const iconColor = state === "wrong" ? "#ef4444" : "#34d399";

  return (
    <div
      className="flex items-center gap-3 rounded-lg px-3.5 py-2.5 transition-colors duration-150 hover:border-white/20"
      style={OPTION_STYLE[state]}
    >
      <span className="shrink-0 font-mono text-[11px] text-zinc-500">{LETTERS[index]}</span>
      <span className="min-w-0 flex-1 font-mono text-[13px] leading-snug text-zinc-200">
        {label}
      </span>
      {icon && (
        <span className="shrink-0 font-mono text-sm font-bold" style={{ color: iconColor }}>
          {icon}
        </span>
      )}
    </div>
  );
}

export function QCMWidget(w: Widget) {
  const subject = str(w.data.subject, "Quiz");
  const questions = (Array.isArray(w.data.questions) ? w.data.questions : []) as QCMQuestion[];
  const total = num(w.data.totalQuestions, questions.length) || questions.length;
  const startAt = Math.max(0, Math.min(num(w.data.startAtQuestion, 0), questions.length - 1));
  const preAnswered =
    w.data.preAnswered && typeof w.data.preAnswered === "object"
      ? (w.data.preAnswered as Record<number, number>)
      : {};

  const [current, setCurrent] = useState(startAt);
  const [confirmed, setConfirmed] = useState<Record<number, number>>({ ...preAnswered });
  const [submitted, setSubmitted] = useState(false);

  const q = questions[current];
  const isConfirmed = q ? confirmed[current] !== undefined : false;
  const chosen = isConfirmed ? confirmed[current] : null;
  const answeredCount = Object.keys(confirmed).length;
  const progress = total > 0 ? Math.round((answeredCount / total) * 100) : 0;
  const isLast = current === questions.length - 1;

  const select = (i: number) => {
    if (isConfirmed || submitted) return;
    setConfirmed((c) => ({ ...c, [current]: i }));
  };

  const next = () => {
    if (!isConfirmed) return;
    if (isLast) {
      setSubmitted(true);
      useDemoStore.getState().onQCMComplete(confirmed);
      return;
    }
    setCurrent((c) => Math.min(c + 1, questions.length - 1));
  };

  const prev = () => setCurrent((c) => Math.max(c - 1, 0));

  function optionState(i: number): OptState {
    if (!isConfirmed || !q) return "idle";
    if (i === q.correctIndex) return chosen === q.correctIndex ? "correct" : "reveal";
    if (i === chosen) return "wrong";
    return "idle";
  }

  return (
    // stopPropagation so option clicks don't trigger the canvas zoom handler.
    <div className="flex h-full flex-col" onClick={(e) => e.stopPropagation()}>
      {/* Header: subject · Q x of n · progress fill */}
      <div className="shrink-0">
        <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
          <span className="font-mono text-sm font-semibold text-zinc-100">{subject}</span>
          <span className="font-mono text-[11px] text-zinc-500">
            Q{Math.min(current + 1, total)} of {total}
          </span>
        </div>
        <div className="relative h-0.5 w-full bg-white/[0.06]">
          <motion.div
            className="absolute left-0 top-0 h-full"
            style={{ backgroundColor: "#6366f1" }}
            initial={false}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        </div>
      </div>

      {submitted ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3">
          <span className="font-mono text-4xl" style={{ color: "#34d399" }}>
            ✓
          </span>
          <span className="font-mono text-sm text-zinc-200">Quiz submitted</span>
          <span className="font-mono text-[11px] text-zinc-500">
            {answeredCount} of {total} answered
          </span>
        </div>
      ) : !q ? (
        <div className="flex flex-1 items-center justify-center font-mono text-xs text-zinc-600">
          No questions available.
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3 px-4 py-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={current}
              className="flex min-h-0 flex-1 flex-col gap-3"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -18 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              {q.imagePlaceholder && (
                <div
                  className="flex shrink-0 items-center justify-center rounded-md"
                  style={{
                    height: "20%",
                    minHeight: 44,
                    background: "rgba(255,255,255,0.03)",
                    border: "1px dashed rgba(255,255,255,0.1)",
                  }}
                >
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                    {q.imagePlaceholder}
                  </span>
                </div>
              )}

              <p className="shrink-0 font-mono text-[15px] leading-snug text-zinc-100">{q.text}</p>

              <div className="flex min-h-0 flex-1 flex-col justify-center gap-2">
                {q.options.map((opt, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => select(i)}
                    disabled={isConfirmed}
                    className="text-left disabled:cursor-default"
                  >
                    <OptionRow label={opt} index={i} state={optionState(i)} />
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex shrink-0 items-center justify-between pt-1">
            <button
              type="button"
              onClick={prev}
              disabled={current === 0}
              className="font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-200 disabled:opacity-30 disabled:hover:text-zinc-500"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={next}
              disabled={!isConfirmed}
              className="font-mono text-[11px] text-zinc-300 transition-colors hover:text-white disabled:opacity-30 disabled:hover:text-zinc-300"
            >
              {isLast ? "Submit ✓" : "Next →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
