/**
 * Dialog — simple confirmation / choice widget (school demo, Step 4). Used for
 * the Maths lesson prompt ("Want me to walk you through it?").
 *
 * On action click: calls `useDemoStore.getState().handleDialogAction(action)`,
 * then despawns itself from the canvas store.
 *
 * See .claude/docs/WIDGETS.md → `dialog`.
 *
 * Card chrome (border / radius) is applied by `shellConfig` in Canvas.tsx; this
 * renderer fills the inner area and owns its own padding.
 */

import type { Widget } from "./types";
import { useDemoStore } from "@/store/demoStore";
import { useCanvasStore } from "@/store/canvasStore";

interface Action {
  label: string;
  action: string;
  primary?: boolean;
}

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

export function Dialog(w: Widget) {
  const title = str(w.data.title);
  const icon = str(w.data.icon);
  const body = str(w.data.body);
  const actions = (Array.isArray(w.data.actions) ? w.data.actions : []) as Action[];

  const onAction = (action: string) => {
    useDemoStore.getState().handleDialogAction(action);
    useCanvasStore.getState().despawn(w.id);
  };

  return (
    // stopPropagation so button clicks don't trigger the canvas zoom handler.
    <div className="flex h-full flex-col justify-center gap-3 p-5" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="leading-none" style={{ fontSize: 24 }}>{icon}</span>}
        <span className="font-mono text-base font-semibold text-zinc-100">{title}</span>
      </div>

      {body && (
        <p className="font-mono text-[13px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
          {body}
        </p>
      )}

      <div className="mt-1 flex items-center justify-end gap-2.5">
        {actions.map((a, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onAction(a.action)}
            className={
              a.primary
                ? "rounded px-4 py-1.5 font-mono text-[11px] text-white"
                : "rounded px-4 py-1.5 font-mono text-[11px] text-zinc-300 transition-colors hover:bg-white/[0.08]"
            }
            style={a.primary ? { background: "rgba(99,102,241,0.7)" } : undefined}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}
