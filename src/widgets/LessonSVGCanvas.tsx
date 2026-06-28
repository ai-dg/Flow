/**
 * LessonSVGCanvas — the drawing surface for the interactive lesson (school
 * demo, Step 5). Renders the right-triangle and accumulates highlight overlays
 * as the beat index advances.
 *
 * Coordinate system is 0–100 in both axes (mapped to the SVG viewBox). Shapes
 * draw themselves via Framer Motion `pathLength` so strokes grow in rather than
 * snapping to full length. Sub-component of LessonWidget.
 *
 * See .claude/docs/WIDGETS.md → `lesson`.
 */

import { AnimatePresence, motion } from "framer-motion";
import type { LessonBeat } from "@/projects/schoolData";

type Pt = [number, number];
type Vertices = Record<string, Pt>;

interface DrawCmd {
  shape?: string;
  vertices?: Vertices;
  strokeColor?: string;
  animationMs?: number;
  rightAngleMarker?: string;
}

interface HighlightLabel {
  text: string;
  position?: string;
  size?: string;
}

interface HighlightCmd {
  highlightSegment?: string;
  glowColor?: string;
  label?: HighlightLabel;
}

function mid(a: Pt, b: Pt): Pt {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function unit(from: Pt, to: Pt): Pt {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  return [dx / len, dy / len];
}

/** Where a side label sits relative to the segment midpoint. */
function labelPos(m: Pt, position: string | undefined): Pt {
  const off = 6;
  switch (position) {
    case "right-of-segment":
      return [m[0] + off, m[1]];
    case "left-of-segment":
      return [m[0] - off, m[1]];
    case "above-segment":
      return [m[0], m[1] - off];
    case "below-segment":
      return [m[0], m[1] + off + 1];
    default:
      return [m[0] + off, m[1]];
  }
}

/** Inner square stroke marking the right angle at vertex `at`. */
function rightAnglePath(at: Pt, p1: Pt, p2: Pt, size = 6): string {
  const u1 = unit(at, p1);
  const u2 = unit(at, p2);
  const a: Pt = [at[0] + u1[0] * size, at[1] + u1[1] * size];
  const b: Pt = [at[0] + u1[0] * size + u2[0] * size, at[1] + u1[1] * size + u2[1] * size];
  const c: Pt = [at[0] + u2[0] * size, at[1] + u2[1] * size];
  return `M ${a[0]} ${a[1]} L ${b[0]} ${b[1]} L ${c[0]} ${c[1]}`;
}

export function LessonSVGCanvas({
  beats,
  currentBeat,
}: {
  beats: LessonBeat[];
  currentBeat: number;
}) {
  const drawIndex = beats.findIndex((b) => b.type === "draw");
  const drawBeat = drawIndex >= 0 ? beats[drawIndex] : undefined;
  const cmd = (drawBeat?.svgCommand ?? {}) as DrawCmd;
  const vertices = cmd.vertices ?? {};
  const names = Object.keys(vertices);
  const triangleVisible = drawIndex >= 0 && currentBeat >= drawIndex;
  const strokeColor = cmd.strokeColor ?? "rgba(255,255,255,0.85)";
  const drawMs = typeof cmd.animationMs === "number" ? cmd.animationMs : 700;

  // Triangle outline path (closed) from the named vertices, in declared order.
  const trianglePath =
    names.length >= 3
      ? `M ${vertices[names[0]][0]} ${vertices[names[0]][1]} ` +
        names
          .slice(1)
          .map((n) => `L ${vertices[n][0]} ${vertices[n][1]}`)
          .join(" ") +
        " Z"
      : "";

  // Right-angle marker geometry.
  const raName = cmd.rightAngleMarker;
  const others = raName ? names.filter((n) => n !== raName) : [];
  const raPath =
    raName && vertices[raName] && others.length >= 2
      ? rightAnglePath(vertices[raName], vertices[others[0]], vertices[others[1]])
      : "";

  // Highlights revealed up to and including the current beat.
  const highlights = beats
    .map((b, i) => ({ b, i }))
    .filter(({ b, i }) => b.type === "highlight" && i <= currentBeat)
    .map(({ b, i }) => {
      const hc = (b.svgCommand ?? {}) as HighlightCmd;
      const seg = hc.highlightSegment ?? "";
      const from = seg[0];
      const to = seg[1];
      const p1 = vertices[from];
      const p2 = vertices[to];
      return p1 && p2 ? { i, p1, p2, glow: hc.glowColor ?? "#6366f1", label: hc.label } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid meet"
      className="h-full w-full"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {/* Triangle outline (draws itself) */}
      {triangleVisible && trianglePath && (
        <motion.path
          d={trianglePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={0.9}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: drawMs / 1000, ease: "easeInOut" }}
        />
      )}

      {/* Right-angle marker */}
      {triangleVisible && raPath && (
        <motion.path
          d={raPath}
          fill="none"
          stroke={strokeColor}
          strokeWidth={0.7}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: drawMs / 1000, duration: 0.3 }}
        />
      )}

      {/* Highlighted segments + side labels */}
      <AnimatePresence>
        {highlights.map(({ i, p1, p2, glow, label }) => {
          const m = mid(p1, p2);
          const lp = label ? labelPos(m, label.position) : null;
          return (
            <g key={`hl-${i}`}>
              {/* Soft glow behind */}
              <motion.line
                x1={p1[0]}
                y1={p1[1]}
                x2={p2[0]}
                y2={p2[1]}
                stroke={glow}
                strokeWidth={3.2}
                strokeLinecap="round"
                style={{ filter: "blur(1.4px)", opacity: 0.55 }}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {/* Crisp line on top */}
              <motion.line
                x1={p1[0]}
                y1={p1[1]}
                x2={p2[0]}
                y2={p2[1]}
                stroke={glow}
                strokeWidth={1.4}
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
              {label && lp && (
                <motion.text
                  x={lp[0]}
                  y={lp[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={glow}
                  fontSize={label.size === "large" ? 7 : 5}
                  fontFamily="'JetBrains Mono', monospace"
                  fontWeight={700}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                >
                  {label.text}
                </motion.text>
              )}
            </g>
          );
        })}
      </AnimatePresence>

      {/* Vertex dots + labels (after the triangle has drawn) */}
      {triangleVisible &&
        names.map((n) => {
          const p = vertices[n];
          // Nudge the label outward from the triangle centroid.
          const cx = names.reduce((sum, k) => sum + vertices[k][0], 0) / names.length;
          const cy = names.reduce((sum, k) => sum + vertices[k][1], 0) / names.length;
          const dir = unit([cx, cy], p);
          return (
            <motion.g
              key={`v-${n}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: drawMs / 1000 + 0.1, duration: 0.3 }}
            >
              <circle cx={p[0]} cy={p[1]} r={1} fill="#ffffff" />
              <text
                x={p[0] + dir[0] * 5}
                y={p[1] + dir[1] * 5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="rgba(255,255,255,0.8)"
                fontSize={4.5}
                fontFamily="'JetBrains Mono', monospace"
              >
                {n}
              </text>
            </motion.g>
          );
        })}
    </svg>
  );
}
