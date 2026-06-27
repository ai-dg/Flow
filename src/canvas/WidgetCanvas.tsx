/**
 * WidgetCanvas — Self-contained demo showcasing all 9 renderable widget types.
 *
 * Drop `<WidgetCanvas />` anywhere to preview the full canvas layout and
 * animations without connecting to the live store or AI layer.
 *
 * Scene: "Reply to Sarah's Q3 Roadmap email"
 *   highlight-overlay — indigo tint covering the email action area (z: lowest)
 *   email-ui          — structured email card with from/subject/preview/timestamp
 *   progress-bar      — Drafting reply · 78% (animates on spawn, exactly 1 second)
 *   image-placeholder — dashed placeholder for an engagement chart
 *   bullet-list       — next actions, staggered 150ms per item
 */

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

type WType =
  | "text-block"
  | "bullet-list"
  | "stat-card"
  | "arrow"
  | "code-block"
  | "highlight-overlay"
  | "progress-bar"
  | "image-placeholder"
  | "email-ui";

interface DemoWidget {
  id: string;
  type: WType;
  /** Position + size as % of canvas (0–100). Arrows use 0/0/0/0. */
  x: number;
  y: number;
  w: number;
  h: number;
  data: Record<string, unknown>;
}

// ─── Demo scene ───────────────────────────────────────────────────────────────

const DEMO_WIDGETS: DemoWidget[] = [
  // ── Scene: "Reply to Sarah's Q3 Roadmap email" ────────────────────────────

  // 1. Indigo overlay (spawned first = lowest z-index, sits behind email + bar)
  {
    id: "hl-focus",
    type: "highlight-overlay",
    x: 3, y: 4, w: 56, h: 68,
    data: { color: "indigo" },
  },

  // 2. Email card (on top of the overlay)
  {
    id: "email-sarah",
    type: "email-ui",
    x: 6, y: 8, w: 50, h: 35,
    data: {
      from: "sarah@acme.com",
      subject: "Re: Q3 Roadmap",
      previewText:
        "Looks great! The canvas prototype is exactly what I had in mind. Let's sync Thursday at 3pm to walk through the demo flow before the board presentation.",
      timestamp: "10:42 AM",
    },
  },

  // 3. Progress bar — action status (animates to 78% over exactly 1 second)
  {
    id: "prog-reply",
    type: "progress-bar",
    x: 6, y: 47, w: 50, h: 20,
    data: { label: "Drafting reply", targetValue: 78 },
  },

  // 4. Image placeholder — engagement chart
  {
    id: "img-chart",
    type: "image-placeholder",
    x: 63, y: 4, w: 33, h: 44,
    data: {
      label: "Email Engagement Rate",
      description: "Open & click-through trends (90d)",
    },
  },

  // 5. Bullet list — next actions
  {
    id: "next-actions",
    type: "bullet-list",
    x: 63, y: 52, w: 33, h: 38,
    data: {
      items: [
        "Reply to Sarah by 2pm",
        "Book Thursday 3pm slot",
        "Update demo slide deck",
        "Share Figma link with team",
      ],
    },
  },

  // Connecting arrows
  {
    id: "arr-email-prog",
    type: "arrow",
    x: 0, y: 0, w: 0, h: 0,
    data: { from: "email-sarah", to: "prog-reply" },
  },
  {
    id: "arr-email-chart",
    type: "arrow",
    x: 0, y: 0, w: 0, h: 0,
    data: { from: "email-sarah", to: "img-chart" },
  },
];

// ─── Syntax highlighting (for code-block — kept for parity) ──────────────────

const KEYWORDS = new Set([
  "async", "await", "function", "const", "let", "var", "if", "else",
  "return", "for", "while", "of", "in", "new", "class", "import",
  "from", "export", "default", "try", "catch", "throw", "switch", "case",
]);
const BUILTINS = new Set(["true", "false", "null", "undefined"]);

type TokKind = "kw" | "builtin" | "str" | "comment" | "num" | "plain";

const TOK_CLASS: Record<TokKind, string> = {
  kw:      "text-violet-400",
  builtin: "text-orange-400",
  str:     "text-emerald-400",
  comment: "text-zinc-500",
  num:     "text-amber-300",
  plain:   "text-zinc-300",
};

function tokenize(code: string): { kind: TokKind; value: string }[] {
  const RE =
    /(\/\/[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)/g;
  const out: { kind: TokKind; value: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(code)) !== null) {
    if (m.index > last) out.push({ kind: "plain", value: code.slice(last, m.index) });
    const v = m[0];
    let kind: TokKind = "plain";
    if (/^\/\//.test(v))       kind = "comment";
    else if (/^["'`]/.test(v)) kind = "str";
    else if (/^\d/.test(v))    kind = "num";
    else if (KEYWORDS.has(v))  kind = "kw";
    else if (BUILTINS.has(v))  kind = "builtin";
    out.push({ kind, value: v });
    last = RE.lastIndex;
  }
  if (last < code.length) out.push({ kind: "plain", value: code.slice(last) });
  return out;
}

// ─── Widget renderers ─────────────────────────────────────────────────────────

function str(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function TextBlock({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex h-full flex-col gap-3">
      {str(data.title) && (
        <div className="border-b border-zinc-800 pb-2.5">
          <span className="select-none font-mono text-[10px] text-zinc-600">// </span>
          <span className="font-mono text-sm font-semibold text-zinc-100">
            {str(data.title)}
          </span>
        </div>
      )}
      <p className="font-mono text-xs leading-relaxed text-zinc-400">{str(data.body)}</p>
    </div>
  );
}

function BulletList({ data }: { data: Record<string, unknown> }) {
  const items = Array.isArray(data.items) ? data.items.map(String) : [];
  return (
    <ul className="flex h-full flex-col justify-center gap-3.5">
      {items.map((item, i) => (
        <motion.li
          key={i}
          className="flex items-start gap-3"
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.22, delay: i * 0.15, ease: "easeOut" }}
        >
          <span className="mt-0.5 select-none font-mono text-xs text-emerald-500">›</span>
          <span className="font-mono text-xs leading-relaxed text-zinc-300">{item}</span>
        </motion.li>
      ))}
    </ul>
  );
}

function StatCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
      <div className="font-mono font-bold leading-none tracking-tight text-white" style={{ fontSize: 48 }}>
        {str(data.value)}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
        {str(data.label)}
      </div>
    </div>
  );
}

function CodeBlock({ data }: { data: Record<string, unknown> }) {
  const tokens = tokenize(str(data.code));
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="ml-2 select-none font-mono text-[10px] text-zinc-700">ts</span>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        <code>
          {tokens.map((t, i) => (
            <span key={i} className={TOK_CLASS[t.kind]}>{t.value}</span>
          ))}
        </code>
      </pre>
    </div>
  );
}

// ── New specialized types ─────────────────────────────────────────────────────

function HighlightOverlay({ data }: { data: Record<string, unknown> }) {
  const TINTS: Record<string, { bg: string; border: string }> = {
    indigo:  { bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)" },
    amber:   { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.22)" },
    emerald: { bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.22)" },
    sky:     { bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.22)" },
    red:     { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"  },
  };
  const key = str(data.color, "indigo");
  const { bg, border } = TINTS[key] ?? TINTS.indigo;
  return (
    <div
      className="h-full w-full"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    />
  );
}

function ProgressBar({ data }: { data: Record<string, unknown> }) {
  const label  = str(data.label, "Progress");
  const target = typeof data.targetValue === "number"
    ? Math.min(100, Math.max(0, data.targetValue))
    : 0;
  const barColor =
    target < 33 ? "#ef4444" :
    target < 67 ? "#f59e0b" :
    "#10b981";
  const filled = Math.round(target / 5);
  const asciiBar = "█".repeat(filled) + "░".repeat(20 - filled);

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-400">{label}</span>
        <span className="font-mono text-xs font-bold text-zinc-200">{target}%</span>
      </div>
      <div className="relative h-1.5 w-full overflow-hidden bg-zinc-800">
        <motion.div
          className="absolute left-0 top-0 h-full"
          style={{ backgroundColor: barColor }}
          initial={{ width: "0%" }}
          animate={{ width: `${target}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
      <div
        className="select-none font-mono text-zinc-700"
        style={{ fontSize: 9, letterSpacing: "-0.04em" }}
      >
        {asciiBar}
      </div>
    </div>
  );
}

function ImagePlaceholder({ data }: { data: Record<string, unknown> }) {
  const label = str(data.label, "Visual Asset");
  const desc  = str(data.description);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <div
        className="select-none font-mono leading-tight text-zinc-700"
        style={{ fontSize: 9 }}
      >
        {["┌─────────────┐",
          "│ ▓▓▓░░░░░░░ │",
          "│ ▓▓▓▓▓░░░░░ │",
          "│ ░░░▓▓▓▓▓░░ │",
          "└─────────────┘"].map((row, i) => <div key={i}>{row}</div>)}
      </div>
      <div className="text-center">
        <div className="font-mono text-xs font-semibold text-zinc-500">{label}</div>
        {desc && <div className="mt-1 font-mono text-[10px] text-zinc-700">{desc}</div>}
      </div>
    </div>
  );
}

function EmailUi({ data }: { data: Record<string, unknown> }) {
  const from        = str(data.from, "sender@domain.com");
  const subject     = str(data.subject, "(no subject)");
  const previewText = str(data.previewText, str(data.preview, str(data.body, "")));
  const timestamp   = str(data.timestamp);
  const name        = from.includes("@") ? from.split("@")[0] : from;
  const initials    = name.slice(0, 2).toUpperCase();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 pb-2">
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="ml-1.5 select-none font-mono text-[10px] text-zinc-700">gmail · inbox</span>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden py-2">
        <div className="mb-2.5 flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-zinc-800 font-mono text-[10px] font-bold text-zinc-400">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-1">
              <span className="truncate font-mono text-xs font-semibold text-zinc-200">{name}</span>
              {timestamp && (
                <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-600">
                  {timestamp}
                </span>
              )}
            </div>
            <div className="truncate font-mono text-[10px] text-zinc-700">{from}</div>
          </div>
        </div>
        <div className="mb-1.5 font-mono text-sm font-bold text-zinc-100">{subject}</div>
        <div className="mb-2 border-t border-zinc-800" />
        <p
          className="font-mono text-xs leading-relaxed text-zinc-500"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}
        >
          {previewText}
        </p>
      </div>
      <div className="flex shrink-0 gap-4 border-t border-zinc-800 pt-2">
        {["reply", "fwd", "archive"].map((a) => (
          <span key={a} className="cursor-default select-none font-mono text-[10px] text-zinc-700">
            [{a}]
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Arrow SVG overlay ────────────────────────────────────────────────────────

function edgePt(
  w: DemoWidget,
  side: "right" | "left" | "top" | "bottom"
): { x: number; y: number } {
  const cx = w.x + w.w / 2;
  const cy = w.y + w.h / 2;
  return side === "right"  ? { x: w.x + w.w, y: cy }
       : side === "left"   ? { x: w.x,        y: cy }
       : side === "top"    ? { x: cx,          y: w.y }
       :                     { x: cx,          y: w.y + w.h };
}

function ArrowOverlay({ widgets }: { widgets: DemoWidget[] }) {
  const byId: Record<string, DemoWidget> = {};
  for (const w of widgets) byId[w.id] = w;

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width="100%"
      height="100%"
      style={{ zIndex: 5 }}
      aria-hidden
    >
      <defs>
        <marker id="wc-tip" markerWidth="7" markerHeight="5" refX="6" refY="2.5" orient="auto">
          <polygon points="0 0, 7 2.5, 0 5" fill="#3f3f46" />
        </marker>
      </defs>
      {widgets
        .filter((w) => w.type === "arrow" && w.data.from && w.data.to)
        .map((a) => {
          const src = byId[a.data.from as string];
          const tgt = byId[a.data.to   as string];
          if (!src || !tgt) return null;
          const dx = (tgt.x + tgt.w / 2) - (src.x + src.w / 2);
          const dy = (tgt.y + tgt.h / 2) - (src.y + src.h / 2);
          const horiz = Math.abs(dx) >= Math.abs(dy);
          const start = horiz
            ? edgePt(src, dx > 0 ? "right"  : "left")
            : edgePt(src, dy > 0 ? "bottom" : "top");
          const end = horiz
            ? edgePt(tgt, dx > 0 ? "left"  : "right")
            : edgePt(tgt, dy > 0 ? "top"   : "bottom");
          return (
            <line
              key={a.id}
              x1={`${start.x}%`} y1={`${start.y}%`}
              x2={`${end.x}%`}   y2={`${end.y}%`}
              stroke="#3f3f46" strokeWidth="1" strokeDasharray="5 4"
              markerEnd="url(#wc-tip)"
            />
          );
        })}
    </svg>
  );
}

// ─── Shell style per type ─────────────────────────────────────────────────────

function shellCfg(type: WType): { outer: string; inner: string } {
  switch (type) {
    case "highlight-overlay":
      return { outer: "h-full w-full overflow-hidden", inner: "h-full w-full" };
    case "image-placeholder":
      return {
        outer: "h-full w-full overflow-hidden border border-dashed border-zinc-700 bg-zinc-950",
        inner: "h-full w-full p-4",
      };
    default:
      return {
        outer: "h-full w-full overflow-hidden border border-zinc-800 bg-zinc-950",
        inner: "h-full w-full p-4",
      };
  }
}

// ─── Widget shell ─────────────────────────────────────────────────────────────

function WidgetShell({
  widget,
  index,
  onDismiss,
  children,
}: {
  widget: DemoWidget;
  index: number;
  onDismiss: (id: string) => void;
  children: React.ReactNode;
}) {
  const cfg = shellCfg(widget.type);
  return (
    <motion.div
      className="absolute cursor-pointer"
      style={{
        left:   `${widget.x}%`,
        top:    `${widget.y}%`,
        width:  `${widget.w}%`,
        height: `${widget.h}%`,
        zIndex: 10 + index,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.2, ease: "easeIn" },
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      onClick={() => onDismiss(widget.id)}
      whileHover={{ zIndex: widget.type === "highlight-overlay" ? 10 + index : 20 }}
    >
      <div className={cfg.outer}>
        <div className={cfg.inner}>{children}</div>
      </div>
    </motion.div>
  );
}

// ─── WidgetCanvas ─────────────────────────────────────────────────────────────

export function WidgetCanvas() {
  const [widgets, setWidgets] = useState<DemoWidget[]>(DEMO_WIDGETS);

  function despawn(id: string) {
    setWidgets((ws) => ws.filter((w) => w.id !== id));
  }

  function reset() {
    setWidgets(DEMO_WIDGETS);
  }

  const renderable = widgets.filter((w) => w.type !== "arrow");
  const totalRenderable = DEMO_WIDGETS.filter((w) => w.type !== "arrow").length;
  const allDismissed = renderable.length === 0;

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: "100%",
        height: "100vh",
        backgroundColor: "#09090b",
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)",
        backgroundSize: "28px 28px",
      }}
    >
      <ArrowOverlay widgets={widgets} />

      <AnimatePresence>
        {renderable.map((w, i) => (
          <WidgetShell key={w.id} widget={w} index={i} onDismiss={despawn}>
            {w.type === "text-block"        && <TextBlock        data={w.data} />}
            {w.type === "bullet-list"       && <BulletList       data={w.data} />}
            {w.type === "stat-card"         && <StatCard         data={w.data} />}
            {w.type === "code-block"        && <CodeBlock        data={w.data} />}
            {w.type === "highlight-overlay" && <HighlightOverlay data={w.data} />}
            {w.type === "progress-bar"      && <ProgressBar      data={w.data} />}
            {w.type === "image-placeholder" && <ImagePlaceholder data={w.data} />}
            {w.type === "email-ui"          && <EmailUi          data={w.data} />}
          </WidgetShell>
        ))}
      </AnimatePresence>

      {/* HUD */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 select-none font-mono text-[10px] text-zinc-700">
        {allDismissed ? (
          <button
            onClick={reset}
            className="text-zinc-500 underline underline-offset-2 transition-colors hover:text-zinc-300"
          >
            reset canvas
          </button>
        ) : (
          <>
            click any widget to despawn
            {renderable.length < totalRenderable && (
              <>
                {" · "}
                <button
                  onClick={reset}
                  className="text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
                >
                  reset
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
