/**
 * LessonNarration — right-hand panel of the interactive lesson (school demo,
 * Step 5). Shows the current beat's instruction text and a pulsing "OK?" prompt
 * the student confirms to advance. On the final (equation) beat the OK prompt is
 * replaced by a "Lesson complete" badge.
 *
 * Sub-component of LessonWidget. See .claude/docs/WIDGETS.md → `lesson`.
 */

import { AnimatePresence, motion } from "framer-motion";

export function LessonNarration({
  instruction,
  understood,
  struggling,
  showOK,
  complete,
  onOK,
}: {
  instruction: string;
  /** Concepts the tutor's comprehension state marks confirmed — a running checklist. */
  understood: string[];
  /** Concepts the student is currently confused about — surfaced so the memory is visible. */
  struggling: string[];
  showOK: boolean;
  complete: boolean;
  onOK: () => void;
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-4 p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-2">
        <span className="select-none font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
          Lesson
        </span>
        <AnimatePresence mode="wait">
          <motion.p
            key={instruction}
            className="font-mono text-[13px] leading-relaxed text-zinc-200"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {instruction}
          </motion.p>
        </AnimatePresence>

        {/* Cross-turn memory made visible: what the tutor knows you've grasped. */}
        {understood.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-700">
              Understood
            </span>
            {understood.map((c) => (
              <motion.div
                key={c}
                className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <span style={{ color: "#34d399" }}>✓</span>
                <span>{c}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Concepts the tutor is still working through with the student. */}
        {struggling.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            <span className="select-none font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-700">
              Still fuzzy
            </span>
            {struggling.map((c) => (
              <motion.div
                key={c}
                className="flex items-center gap-1.5 font-mono text-[11px] text-zinc-400"
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <span style={{ color: "#fbbf24" }}>~</span>
                <span>{c}</span>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0">
        {complete ? (
          <motion.div
            className="inline-flex items-center gap-2 rounded-md px-3 py-1.5"
            style={{ background: "rgba(52,211,153,0.15)", border: "1px solid #34d399" }}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <span className="font-mono text-sm" style={{ color: "#34d399" }}>
              ✓
            </span>
            <span className="font-mono text-[11px] text-zinc-200">Lesson complete</span>
          </motion.div>
        ) : showOK ? (
          <div className="flex flex-col gap-1.5">
            <motion.button
              type="button"
              onClick={onOK}
              className="self-start rounded-full px-4 py-1.5 font-mono text-[11px] text-zinc-100"
              style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)" }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              Got it →
            </motion.button>
            <span className="select-none font-mono text-[10px] text-zinc-600">
              …or just ask a question
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
