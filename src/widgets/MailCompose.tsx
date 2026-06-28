/**
 * MailCompose — email compose widget (school demo, Step 3). Pre-filled by the
 * AI, confirmable by voice. The body is an editable textarea for realism;
 * attachment pills are display-only.
 *
 * On Send: plays the sent animation (Sending… → ✓), then calls
 * `useDemoStore.getState().onMailSent()`. The actual Gmail MCP send is
 * best-effort and intentionally never blocks the animation — the demo must
 * never fail visibly (see .claude/docs/AI_CONTRACT.md).
 *
 * See .claude/docs/WIDGETS.md → `mail-compose`.
 *
 * Card chrome (border / radius) is applied by `shellConfig` in Canvas.tsx; this
 * renderer fills the inner area and owns its own padding.
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Widget } from "./types";
import { useDemoStore } from "@/store/demoStore";

interface Attachment {
  name: string;
  type?: string;
  sourceWidgetId?: string;
}

interface Recipient {
  name?: string;
  email?: string;
}

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

type SendState = "idle" | "sending" | "sent";

export function MailCompose(w: Widget) {
  const to = (w.data.to && typeof w.data.to === "object" ? w.data.to : {}) as Recipient;
  const subject = str(w.data.subject, "(no subject)");
  const attachments = (Array.isArray(w.data.attachments) ? w.data.attachments : []) as Attachment[];
  const readyToSend = w.data.readyToSend !== false;

  const [body, setBody] = useState(str(w.data.body));
  const [state, setState] = useState<SendState>("idle");

  const send = () => {
    if (state !== "idle") return;
    setState("sending");
    // Best-effort: a real Gmail MCP send would fire here, but it must never
    // block or fail the animation. Advance on a fixed timeline regardless.
    window.setTimeout(() => {
      setState("sent");
      window.setTimeout(() => useDemoStore.getState().onMailSent(), 700);
    }, 800);
  };

  // ── Sent overlay ──────────────────────────────────────────────────────────
  if (state === "sent") {
    return (
      <div className="flex h-full items-center justify-center" onClick={(e) => e.stopPropagation()}>
        <motion.div
          className="flex flex-col items-center gap-3"
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          <span className="font-mono text-5xl" style={{ color: "#34d399" }}>
            ✓
          </span>
          <span className="font-mono text-xs text-zinc-300">Sent</span>
        </motion.div>
      </div>
    );
  }

  return (
    // stopPropagation so field/button clicks don't trigger the canvas zoom handler.
    <div className="flex h-full flex-col p-4" onClick={(e) => e.stopPropagation()}>
      <span className="select-none font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        New Message
      </span>

      <div className="mt-3 flex flex-col gap-2">
        <div className="flex gap-2 font-mono text-[12px]">
          <span className="shrink-0 text-zinc-600">To:</span>
          <span className="text-zinc-100">
            {str(to.name)} {to.email ? <span className="text-zinc-500">&lt;{to.email}&gt;</span> : null}
          </span>
        </div>
        <div className="flex gap-2 font-mono text-[12px]">
          <span className="shrink-0 text-zinc-600">Subject:</span>
          <span className="text-zinc-100">{subject}</span>
        </div>
      </div>

      <div className="my-3 border-t border-white/10" />

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        spellCheck={false}
        className="min-h-0 flex-1 resize-none bg-transparent font-mono text-[13px] leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-700"
        placeholder="Write your message…"
      />

      {attachments.length > 0 && (
        <>
          <div className="my-3 border-t border-white/10" />
          <div className="flex flex-wrap gap-2">
            {attachments.map((a, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 rounded px-2 py-1 font-mono text-[10px] text-zinc-300"
                style={{ background: "rgba(255,255,255,0.06)" }}
              >
                📎 {a.name}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="my-3 border-t border-white/10" />

      <div className="flex shrink-0 items-center justify-end gap-3">
        <button
          type="button"
          className="font-mono text-[11px] text-zinc-500 transition-colors hover:text-zinc-300"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={state === "sending"}
          className="rounded px-4 py-1.5 font-mono text-[11px] text-white transition-opacity disabled:opacity-70"
          style={{ background: readyToSend ? "rgba(99,102,241,0.7)" : "rgba(255,255,255,0.08)" }}
        >
          <AnimatePresence mode="wait" initial={false}>
            {state === "sending" ? (
              <motion.span
                key="sending"
                className="inline-flex items-center gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="inline-block"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                >
                  ◜
                </motion.span>
                Sending…
              </motion.span>
            ) : (
              <motion.span
                key="send"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                Send ✓
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </div>
  );
}
