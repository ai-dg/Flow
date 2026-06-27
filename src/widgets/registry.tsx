/**
 * Widget renderer registry.
 *
 * Each entry maps a WidgetType to a render function that receives the full
 * Widget object and returns JSX. Aesthetic: cyber-minimalist / ASCII terminal —
 * solid dark backgrounds, sharp borders, font-mono throughout.
 *
 * To add a widget: add its type to types.ts, add a renderer here, register it
 * in WIDGETS below, and add a catalog entry to ai/systemPrompt.ts.
 */

import { motion } from "framer-motion";
import type { Widget, WidgetType } from "./types";

type Renderer = (w: Widget) => JSX.Element;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function s(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

function list(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

// ─── Syntax highlighting ──────────────────────────────────────────────────────

const KEYWORDS = new Set([
  "async", "await", "function", "const", "let", "var", "if", "else",
  "return", "for", "while", "of", "in", "new", "class", "import",
  "from", "export", "default", "try", "catch", "throw", "switch", "case",
  "def", "with", "pass", "yield", "lambda", "and", "or", "not",
]);
const BUILTINS = new Set([
  "true", "false", "null", "undefined", "None", "True", "False",
]);

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
    /(\/\/[^\n]*|#[^\n]*|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`|\b\d+\.?\d*\b|\b[a-zA-Z_$][a-zA-Z0-9_$]*\b)/g;
  const out: { kind: TokKind; value: string }[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(code)) !== null) {
    if (m.index > last) out.push({ kind: "plain", value: code.slice(last, m.index) });
    const v = m[0];
    let kind: TokKind = "plain";
    if (/^\/\/|^#/.test(v))    kind = "comment";
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

// ─── Renderers ────────────────────────────────────────────────────────────────

const TextWidget: Renderer = (w) => (
  <p className="font-mono text-xs leading-relaxed text-zinc-400">
    {s(w.data.text)}
  </p>
);

const HeadingWidget: Renderer = (w) => (
  <div className="flex h-full items-center">
    <h1 className="font-mono text-2xl font-bold tracking-tight text-zinc-100">
      {s(w.data.text)}
    </h1>
  </div>
);

const BulletsWidget: Renderer = (w) => (
  <ul className="flex h-full flex-col justify-center gap-3">
    {list(w.data.items).map((item, i) => (
      <motion.li
        key={i}
        className="flex items-start gap-3"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.22, delay: i * 0.15, ease: "easeOut" }}
      >
        <span className="mt-0.5 select-none font-mono text-xs text-emerald-500">›</span>
        <span className="font-mono text-xs leading-relaxed text-zinc-300">{item}</span>
      </motion.li>
    ))}
  </ul>
);

const StatWidget: Renderer = (w) => (
  <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
    <div
      className="font-mono font-bold leading-none tracking-tight text-white"
      style={{ fontSize: 48 }}
    >
      {s(w.data.value)}
    </div>
    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
      {s(w.data.label)}
    </div>
  </div>
);

const CardWidget: Renderer = (w) => (
  <div className="flex h-full flex-col gap-3">
    {s(w.data.title) && (
      <div className="border-b border-zinc-800 pb-2.5">
        <span className="select-none font-mono text-[10px] text-zinc-600">// </span>
        <span className="font-mono text-sm font-semibold text-zinc-100">
          {s(w.data.title)}
        </span>
      </div>
    )}
    <p className="font-mono text-xs leading-relaxed text-zinc-400">
      {s(w.data.body)}
    </p>
  </div>
);

const ArrowWidget: Renderer = (w) => {
  // Connecting arrows (data.from + data.to) are rendered by the SVG overlay
  // in Canvas.tsx — this widget returns nothing and its shell is hidden.
  if (w.data.from && w.data.to) return <></>;

  const dir = s(w.data.direction, "right");
  const rot = dir === "down" ? 90 : dir === "left" ? 180 : dir === "up" ? -90 : 0;
  return (
    <div className="flex h-full items-center justify-center">
      <svg
        viewBox="0 0 100 24"
        className="w-full text-zinc-500"
        style={{ transform: `rotate(${rot}deg)` }}
      >
        <line
          x1="2" y1="12" x2="84" y2="12"
          stroke="currentColor" strokeWidth="1.5" strokeDasharray="6 4"
        />
        <polyline
          points="74,5 88,12 74,19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

const ImageWidget: Renderer = (w) => (
  <figure className="flex h-full flex-col gap-2">
    <img
      src={s(w.data.src)}
      alt={s(w.data.alt, "image")}
      className="min-h-0 flex-1 object-cover"
    />
    {s(w.data.caption) && (
      <figcaption className="select-none text-center font-mono text-[10px] text-zinc-600">
        {s(w.data.caption)}
      </figcaption>
    )}
  </figure>
);

const CodeWidget: Renderer = (w) => {
  const tokens = tokenize(s(w.data.code));
  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-zinc-800 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="ml-2 select-none font-mono text-[10px] text-zinc-700">
          {s(w.data.lang, "code")}
        </span>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed">
        <code>
          {tokens.map((t, i) => (
            <span key={i} className={TOK_CLASS[t.kind]}>
              {t.value}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};

const HighlightOverlayWidget: Renderer = (w) => {
  const TINTS: Record<string, { bg: string; border: string }> = {
    indigo:  { bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)" },
    amber:   { bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.22)" },
    emerald: { bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.22)" },
    sky:     { bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.22)" },
    red:     { bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.18)"  },
  };
  const key = s(w.data.color, "indigo");
  const { bg, border } = TINTS[key] ?? TINTS.indigo;
  return (
    <div
      className="h-full w-full"
      style={{ backgroundColor: bg, border: `1px solid ${border}` }}
    />
  );
};

const ProgressBarWidget: Renderer = (w) => {
  const label  = s(w.data.label, "Progress");
  const target = typeof w.data.targetValue === "number"
    ? Math.min(100, Math.max(0, w.data.targetValue))
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
};

const ImagePlaceholderWidget: Renderer = (w) => {
  const label = s(w.data.label, "Visual Asset");
  const desc  = s(w.data.description);
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
          "└─────────────┘"].map((row, i) => (
          <div key={i}>{row}</div>
        ))}
      </div>
      <div className="text-center">
        <div className="font-mono text-xs font-semibold text-zinc-500">{label}</div>
        {desc && (
          <div className="mt-1 font-mono text-[10px] text-zinc-700">{desc}</div>
        )}
      </div>
    </div>
  );
};

const EmailUiWidget: Renderer = (w) => {
  const from     = s(w.data.from, "sender@domain.com");
  const subject  = s(w.data.subject, "(no subject)");
  const raw      = s(w.data.previewText, s(w.data.preview, s(w.data.body, "")));
  const snippet  = raw.length > 100 ? raw.slice(0, 100) + "…" : raw;
  const tsRaw    = s(w.data.timestamp);
  const timeLabel= tsRaw
    ? (tsRaw.includes("T") || tsRaw.includes("-") ? relativeTime(tsRaw) : tsRaw)
    : "";
  const unread   = Boolean(w.data.unread);

  // Sender display name — strip email host and replace separators with spaces
  const localPart   = from.includes("@") ? from.split("@")[0] : from;
  const displayName = localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const initials    = displayName.split(" ").map((p) => p[0] ?? "").join("").slice(0, 2);
  const color       = avatarColor(localPart);

  return (
    <div className="flex h-full items-center gap-3.5 px-4 py-2">
      {/* Minimalist circle avatar */}
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {initials}
        {unread && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 bg-indigo-400"
            style={{ borderColor: "#111111" }}
          />
        )}
      </div>

      {/* Text column */}
      <div className="min-w-0 flex-1">
        {/* Sender + timestamp */}
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate font-mono text-xs ${
              unread ? "font-semibold text-zinc-100" : "font-normal text-zinc-400"
            }`}
          >
            {displayName}
          </span>
          {timeLabel && (
            <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-600">
              {timeLabel}
            </span>
          )}
        </div>

        {/* Subject */}
        <div
          className={`mt-0.5 truncate font-mono text-[11px] ${
            unread ? "font-medium text-zinc-200" : "text-zinc-500"
          }`}
        >
          {subject}
        </div>

        {/* Snippet — exactly 100 chars max */}
        <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
          {snippet}
        </div>
      </div>
    </div>
  );
};

// ─── Shared helpers for EmailUiWidget ────────────────────────────────────────

const AVATAR_PALETTE = [
  "#4f46e5", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#7c3aed", "#0284c7",
];

function avatarColor(seed: string): string {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (isNaN(diff) || diff < 0) return iso; // pass-through if not parseable
  const m = Math.floor(diff / 60_000);
  if (m < 1)   return "now";
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric" });
}

const EmailWidget: Renderer = (w) => (
  <div className="flex h-full flex-col overflow-hidden">
    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-800 px-3 py-2">
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
        <span className="h-2 w-2 rounded-full bg-zinc-800" />
      </div>
      <span className="ml-1 select-none font-mono text-[10px] text-zinc-700">mail</span>
    </div>
    <div className="min-h-0 flex-1 overflow-auto p-3">
      <div className="mb-3 border-b border-zinc-800 pb-3">
        <div className="font-mono text-sm font-semibold text-zinc-100">
          {s(w.data.subject, "(no subject)")}
        </div>
        <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
          {s(w.data.from)}
        </div>
      </div>
      <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">
        {s(w.data.body)}
      </p>
    </div>
  </div>
);

// ─── Registry ─────────────────────────────────────────────────────────────────

export const WIDGETS: Record<WidgetType, Renderer> = {
  text:    TextWidget,
  heading: HeadingWidget,
  bullets: BulletsWidget,
  stat:    StatWidget,
  card:    CardWidget,
  arrow:   ArrowWidget,
  image:   ImageWidget,
  code:    CodeWidget,
  email:   EmailWidget,
  "highlight-overlay":  HighlightOverlayWidget,
  "progress-bar":       ProgressBarWidget,
  "image-placeholder":  ImagePlaceholderWidget,
  "email-ui":           EmailUiWidget,
};
