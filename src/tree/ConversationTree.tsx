import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useTreeStore, type TreeNode } from "@/store/treeStore";
import { useCanvasStore } from "@/store/canvasStore";
import type { CanvasSnapshot } from "@/store/canvasStore";
import type { Widget } from "@/widgets/types";

// ── Strip geometry ─────────────────────────────────────────────────────────────

const STRIP_H  = 80;
const MARGIN_L = 52;   // px from strip left to first node centre
const NODE_GAP = 88;   // px between adjacent node centres
const NODE_R   = 8;    // node radius → 16px diameter
const ROW_Y    = [30, 56] as const; // y-centre (px) for row 0 and row 1

// ── DFS layout ────────────────────────────────────────────────────────────────
// Assigns each node a (col, row). First child stays on same row; subsequent
// children (forks) increment the row. Col increments monotonically via DFS,
// ensuring every node is to the right of its parent.

interface NodePos { col: number; row: number }

function buildLayout(
  nodes: Record<string, TreeNode>,
  rootId: string | null,
): Record<string, NodePos> {
  const out: Record<string, NodePos> = {};
  if (!rootId || !nodes[rootId]) return out;
  let col = 0;

  function dfs(id: string, row: number) {
    const node = nodes[id];
    if (!node) return;
    out[id] = { col: col++, row };
    node.childIds.forEach((cid, i) => dfs(cid, row + (i > 0 ? 1 : 0)));
  }
  dfs(rootId, 0);
  return out;
}

function toXY(pos: NodePos) {
  return {
    x: MARGIN_L + pos.col * NODE_GAP,
    y: ROW_Y[Math.min(pos.row, 1)],
  };
}

// ── Mock snapshot builders ────────────────────────────────────────────────────

const CODE_ASYNC = [
  "async function fetchUser(id: string) {",
  "  try {",
  "    const res = await fetch(`/api/users/${id}`);",
  "    if (!res.ok) throw new Error(res.statusText);",
  "    return await res.json();",
  "  } catch (err) {",
  "    console.error('fetch failed:', err);",
  "    return null;",
  "  }",
  "}",
].join("\n");

function mkw(
  id: string, type: Widget["type"],
  x: number, y: number, ww: number, h: number,
  data: Record<string, unknown>,
): Widget {
  return { id, type, x, y, w: ww, h, scale: 1, opacity: 1, data };
}

function mksnap(...widgets: Widget[]): CanvasSnapshot {
  return {
    widgets:         Object.fromEntries(widgets.map((v) => [v.id, v])),
    order:           widgets.map((v) => v.id),
    cameraScale:     1,
    focusedId:       null,
    cameraMode:      "idle",
    cameraTargetId:  null,
    cameraZoomScale: 1,
  };
}

function iso(msBefore: number) {
  return new Date(Date.now() - msBefore).toISOString();
}

// ── Mock history ──────────────────────────────────────────────────────────────
//
// DFS layout (col, row):
//   n1(0,0) ─── n2(1,0) ─── n3(2,0)         ← main: revenue → CI/CD → async/await
//   ╌╌╌╌╌╌╌╌╌╌╌ n4(3,1) ─── n5(4,1)         ← fork: emails → Sarah focus
//
// n4 is n1's second child → row 1. Diagonal dashed indigo line from n1 makes
// the fork visually obvious during the pitch.

const MOCK_NODES: TreeNode[] = [
  {
    id: "n1", parentId: null, childIds: ["n2", "n4"],
    userText:  "Show Q2 revenue dashboard",
    aiSummary: "Q2 revenue hit $2.4M, up 23% year over year.",
    createdAt: Date.now() - 8 * 60_000,
    snapshot: mksnap(
      mkw("s1", "stat",    5, 20, 20, 22, { value: "$2.4M", label: "Q2 Revenue" }),
      mkw("s2", "stat",    5, 54, 20, 22, { value: "+23%",  label: "YoY Growth" }),
      mkw("c1", "card",   30, 10, 38, 35, { title: "Q2 Summary",  body: "Enterprise contracts drove strong performance. Three new logo wins at $180K ACV each." }),
      mkw("b1", "bullets",30, 50, 38, 40, { items: ["Closed Series A — $12M", "Launched v2.0 with AI canvas", "NPS reached 71", "Churn held at 1.2%"] }),
    ),
  },
  {
    id: "n2", parentId: "n1", childIds: ["n3"],
    userText:  "Show the CI/CD pipeline",
    aiSummary: "Three-stage deployment: build, staging, production.",
    createdAt: Date.now() - 6 * 60_000,
    snapshot: mksnap(
      mkw("t1", "card",  8, 25, 24, 40, { title: "① Build",      body: "Run tsc + vitest. Bundle with Vite. Fail fast on type errors." }),
      mkw("t2", "card", 38, 25, 24, 40, { title: "② Staging",    body: "Deploy to Vercel preview. Run E2E with Playwright." }),
      mkw("t3", "card", 68, 25, 24, 40, { title: "③ Production", body: "Merge to main triggers blue-green deploy. 30s rollback." }),
    ),
  },
  {
    id: "n3", parentId: "n2", childIds: [],
    userText:  "Explain async/await in TypeScript",
    aiSummary: "Async/await is syntactic sugar over Promises — reads top-to-bottom.",
    createdAt: Date.now() - 4 * 60_000,
    snapshot: mksnap(
      mkw("r1",    "bullets", 5,  10, 38, 55, { items: ["async functions always return a Promise", "await pauses only the current function", "Wrap in try/catch to handle rejection", "Never await inside forEach — use for-of"] }),
      mkw("code1", "code",   48,  10, 47, 70, { lang: "ts", code: CODE_ASYNC }),
    ),
  },
  {
    id: "n4", parentId: "n1", childIds: ["n5"],
    userText:  "Show my latest emails",
    aiSummary: "Pulling your inbox — four messages need your attention.",
    createdAt: Date.now() - 3 * 60_000,
    snapshot: mksnap(
      mkw("g1", "email-ui",  8,  4, 42, 16, { from: "sarah@acme.com",     subject: "Re: Q3 Roadmap — Board Deck",          previewText: "Looks great! The canvas prototype is exactly what I had in mind. Let's sync Thursday at 3pm.", timestamp: iso(2 * 3_600_000),  unread: true }),
      mkw("g2", "email-ui",  8, 22, 42, 16, { from: "alex@benchmark.vc",  subject: "Series A Term Sheet — Action Required", previewText: "I've attached the term sheet. Move quickly — flag issues by EOD Friday.", timestamp: iso(5 * 3_600_000),  unread: true }),
      mkw("g3", "email-ui",  8, 40, 42, 16, { from: "team@anthropic.com", subject: "Hackathon check-in: 8 hours left",       previewText: "OS-AI flagged for innovative MCP tool-calling and cinematic canvas system.", timestamp: iso(26 * 3_600_000), unread: false }),
      mkw("g4", "email-ui",  8, 58, 42, 16, { from: "yc@ycombinator.com", subject: "YC Demo Day logistics",                  previewText: "Your slot is 2:15 PM in Auditorium A. Four minutes to demo, two minutes Q&A.", timestamp: iso(48 * 3_600_000), unread: true }),
    ),
  },
  {
    id: "n5", parentId: "n4", childIds: [],
    userText:  "Focus on Sarah's email",
    aiSummary: "Zooming in on Sarah's message — drafting reply at 78%.",
    createdAt: Date.now() - 1 * 60_000,
    snapshot: mksnap(
      mkw("hl",   "highlight-overlay",  3,  4, 56, 68, { color: "indigo" }),
      mkw("es",   "email-ui",           6,  8, 50, 35, { from: "sarah@acme.com", subject: "Re: Q3 Roadmap — Board Deck", previewText: "Looks great! Let's sync Thursday at 3pm to walk through the demo before the board presentation.", timestamp: iso(2 * 3_600_000), unread: true }),
      mkw("prog", "progress-bar",       6, 47, 50, 20, { label: "Drafting reply", targetValue: 78 }),
      mkw("img1", "image-placeholder", 62,  4, 33, 44, { label: "Email Analytics", description: "Open & click-through trends (90d)" }),
    ),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export function ConversationTree() {
  const nodes     = useTreeStore((s) => s.nodes);
  const rootId    = useTreeStore((s) => s.rootId);
  const currentId = useTreeStore((s) => s.currentId);
  const goTo      = useTreeStore((s) => s.goTo);
  const seed      = useTreeStore((s) => s.seed);
  const canvasClear   = useCanvasStore((s) => s.clear);
  const canvasRestore = useCanvasStore((s) => s.restore);

  const [navigating, setNavigating] = useState(false);

  // Seed mock history once if tree starts empty.
  useEffect(() => {
    if (Object.keys(nodes).length === 0) seed(MOCK_NODES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const layout   = useMemo(() => buildLayout(nodes, rootId), [nodes, rootId]);
  const nodeList = useMemo(
    () => Object.values(nodes).sort((a, b) => a.createdAt - b.createdAt),
    [nodes],
  );

  // Time-travel: blank canvas → 240ms fade → restore saved snapshot.
  const travel = useCallback(
    async (nodeId: string) => {
      if (nodeId === currentId || navigating) return;
      setNavigating(true);
      canvasClear();
      await new Promise<void>((r) => setTimeout(r, 240));
      const node = goTo(nodeId);
      if (node) canvasRestore(node.snapshot);
      setNavigating(false);
    },
    [currentId, navigating, canvasClear, goTo, canvasRestore],
  );

  if (nodeList.length === 0) return null;

  const maxCol = Math.max(...Object.values(layout).map((p) => p.col), 0);
  const svgW   = Math.max(
    typeof window !== "undefined" ? window.innerWidth : 1280,
    MARGIN_L + maxCol * NODE_GAP + 100,
  );

  const activePos  = currentId ? layout[currentId] : undefined;
  const activeNode = currentId ? nodes[currentId]  : undefined;
  const activeXY   = activePos ? toXY(activePos)   : undefined;

  return (
    <>
      {/* Active-node label — fixed, floats above the strip */}
      {activeNode && activeXY && (
        <motion.div
          key={currentId}
          className="pointer-events-none fixed z-[2001] -translate-x-1/2"
          style={{ left: activeXY.x, bottom: STRIP_H + 8 }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          <span
            className="block max-w-[220px] truncate whitespace-nowrap rounded font-mono text-[9px] text-zinc-400"
            style={{
              padding:    "2px 8px",
              background: "rgba(18,18,20,0.92)",
              border:     "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {activeNode.userText}
          </span>
        </motion.div>
      )}

      {/* Bottom strip */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[2000] overflow-x-auto overflow-y-hidden"
        style={{
          height:               STRIP_H,
          background:           "rgba(0,0,0,0.65)",
          backdropFilter:       "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop:            "1px solid rgba(255,255,255,0.06)",
        }}
      >
        {/* SVG connecting lines */}
        <svg
          className="pointer-events-none absolute left-0 top-0"
          width={svgW}
          height={STRIP_H}
          aria-hidden
        >
          {nodeList.map((node) => {
            if (!node.parentId) return null;
            const fromPos = layout[node.parentId];
            const toPos   = layout[node.id];
            if (!fromPos || !toPos) return null;
            const from   = toXY(fromPos);
            const to     = toXY(toPos);
            const isFork = fromPos.row !== toPos.row;
            return (
              <line
                key={`l-${node.id}`}
                x1={from.x} y1={from.y}
                x2={to.x}   y2={to.y}
                stroke={isFork ? "rgba(99,102,241,0.5)" : "rgba(255,255,255,0.22)"}
                strokeWidth={1}
                strokeDasharray={isFork ? "4 3" : undefined}
              />
            );
          })}
        </svg>

        {/* Node buttons */}
        {nodeList.map((node) => {
          const pos = layout[node.id];
          if (!pos) return null;
          const { x, y } = toXY(pos);
          const isActive = node.id === currentId;
          const isFork   = pos.row > 0;

          return (
            <motion.button
              key={node.id}
              className="absolute focus:outline-none"
              style={{
                left:         x - NODE_R,
                top:          y - NODE_R,
                width:        NODE_R * 2,
                height:       NODE_R * 2,
                borderRadius: "50%",
                cursor:       navigating ? "wait" : "pointer",
                border: isActive
                  ? "1.5px solid rgba(255,255,255,0.95)"
                  : isFork
                    ? "1px solid rgba(99,102,241,0.6)"
                    : "1px solid rgba(255,255,255,0.3)",
                background: isActive ? "white" : "transparent",
              }}
              animate={
                isActive
                  ? {
                      boxShadow: [
                        "0 0 0px 0px rgba(255,255,255,0.7)",
                        "0 0 0px 7px rgba(255,255,255,0.0)",
                      ],
                    }
                  : { boxShadow: "none" }
              }
              transition={
                isActive
                  ? { duration: 1.7, repeat: Infinity, ease: "easeOut" }
                  : { duration: 0.3 }
              }
              whileHover={{ scale: 1.55 }}
              onClick={() => travel(node.id)}
              title={`${node.userText}\n↳ ${node.aiSummary}`}
              aria-label={node.userText}
            />
          );
        })}
      </div>
    </>
  );
}
