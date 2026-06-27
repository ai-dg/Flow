import { useState } from "react";
import type { Widget } from "./types";

type EmailItem = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  read: boolean;
  labels?: string[];
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  "#4f46e5", "#0891b2", "#059669",
  "#d97706", "#dc2626", "#7c3aed", "#0284c7",
];

function avatarColor(seed: string): string {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_PALETTE[n % AVATAR_PALETTE.length];
}

function initials(from: string): string {
  const local = from.includes("@") ? from.split("@")[0] : from;
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function s(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

// ─── Legacy single-card fallback ─────────────────────────────────────────────

function SingleEmailCard({ w }: { w: Widget }) {
  const from      = s(w.data.from, "sender@domain.com");
  const subject   = s(w.data.subject, "(no subject)");
  const rawPrev   = s(w.data.previewText, s(w.data.preview, s(w.data.body, "")));
  const snippet   = rawPrev.length > 100 ? rawPrev.slice(0, 100) + "…" : rawPrev;
  const tsRaw     = s(w.data.timestamp);
  const unread    = Boolean(w.data.unread);
  const color     = avatarColor(from.includes("@") ? from.split("@")[0] : from);
  const init      = initials(from);
  const localPart = from.includes("@") ? from.split("@")[0] : from;
  const display   = localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex h-full items-center gap-3.5 px-4 py-2">
      <div
        className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white"
        style={{ backgroundColor: color }}
      >
        {init}
        {unread && (
          <span
            className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 bg-indigo-400"
            style={{ borderColor: "#111111" }}
          />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className={`truncate font-mono text-xs ${
              unread ? "font-semibold text-zinc-100" : "font-normal text-zinc-400"
            }`}
          >
            {display}
          </span>
          {tsRaw && (
            <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-600">
              {tsRaw}
            </span>
          )}
        </div>
        <div
          className={`mt-0.5 truncate font-mono text-[11px] ${
            unread ? "font-medium text-zinc-200" : "text-zinc-500"
          }`}
        >
          {subject}
        </div>
        <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-600">
          {snippet}
        </div>
      </div>
    </div>
  );
}

// ─── Multi-email list + detail view ──────────────────────────────────────────

function MultiEmailView({ w }: { w: Widget }) {
  const emails      = (w.data.emails as EmailItem[]);
  const unreadCount = typeof w.data.unreadCount === "number" ? w.data.unreadCount : 0;

  const [selectedId, setSelectedId] = useState<string | null>(
    (w.data.selectedId as string | null) ?? null
  );
  const [readSet, setReadSet] = useState<Set<string>>(
    new Set(emails.filter((e) => e.read).map((e) => e.id))
  );

  const selected = emails.find((e) => e.id === selectedId) ?? null;

  function handleSelect(id: string) {
    setSelectedId(id);
    setReadSet((prev) => new Set([...prev, id]));
  }

  return (
    <div
      className="flex h-full overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
    >
      {/* ── Left: email list ─────────────────────────────────────── */}
      <div
        className="flex flex-col"
        style={{
          width: selected ? "42%" : "100%",
          borderRight: selected ? "1px solid rgba(255,255,255,0.08)" : "none",
          transition: "width 300ms ease-out",
        }}
      >
        {/* Inbox header */}
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600">
            inbox
          </span>
          {unreadCount > 0 && (
            <span
              className="flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold text-white"
              style={{ backgroundColor: "#4f46e5" }}
            >
              {unreadCount}
            </span>
          )}
        </div>

        {/* List */}
        <div className="min-h-0 flex-1 overflow-auto">
          {emails.length === 0 ? (
            <div className="flex h-full items-center justify-center font-mono text-[10px] text-zinc-700">
              no emails
            </div>
          ) : (
            emails.map((email) => {
              const isRead     = readSet.has(email.id);
              const isSelected = selectedId === email.id;
              const color      = avatarColor(email.from);
              const init       = initials(email.from);

              return (
                <div
                  key={email.id}
                  onClick={() => handleSelect(email.id)}
                  className="flex cursor-pointer items-center gap-3 border-b border-zinc-900 px-3 py-2.5"
                  style={{
                    opacity:    isRead ? 0.6 : 1,
                    background: isSelected
                      ? "rgba(99,102,241,0.10)"
                      : "transparent",
                    transition: "background 300ms ease-out, opacity 300ms ease-out",
                  }}
                >
                  {/* Avatar */}
                  <div
                    className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-[10px] font-bold text-white"
                    style={{ backgroundColor: color }}
                  >
                    {init}
                    {!isRead && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: "#818cf8",
                          border: "1.5px solid #0d0d0d",
                        }}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span
                        className={`truncate font-mono text-[11px] ${
                          isRead ? "text-zinc-500" : "font-semibold text-zinc-100"
                        }`}
                      >
                        {email.from}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] tabular-nums text-zinc-700">
                        {email.date}
                      </span>
                    </div>
                    <div
                      className={`truncate font-mono text-[10px] ${
                        isRead ? "text-zinc-600" : "text-zinc-300"
                      }`}
                    >
                      {email.subject}
                    </div>
                    <div className="truncate font-mono text-[9px] text-zinc-700">
                      {email.preview}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: detail panel ──────────────────────────────────── */}
      {selected && (
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Detail header */}
          <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
            <div className="font-mono text-sm font-semibold text-zinc-100">
              {selected.subject}
            </div>
            <div className="mt-1 font-mono text-[10px] text-zinc-500">
              {selected.from}
            </div>
            <div className="mt-0.5 font-mono text-[9px] text-zinc-700">
              {selected.date}
            </div>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-zinc-400">
              {selected.preview}
            </p>
            {selected.labels && selected.labels.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {selected.labels.map((label) => (
                  <span
                    key={label}
                    className="rounded px-1.5 py-0.5 font-mono text-[9px] text-zinc-600"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Exported renderer ───────────────────────────────────────────────────────

export function EmailWidget(w: Widget): JSX.Element {
  if (Array.isArray(w.data.emails)) {
    return <MultiEmailView w={w} />;
  }
  return <SingleEmailCard w={w} />;
}
