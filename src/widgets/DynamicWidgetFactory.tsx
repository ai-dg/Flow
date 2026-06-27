/**
 * Dynamic Widget Factory
 *
 * Routes on widget.data.original_type (preserved from Claude's raw JSON by
 * dispatchDynamicCanvas) to the matching content component.
 * Unknown type strings fall back to FallbackContent — canvas never crashes.
 *
 * Four first-class types:
 *   custom-card      — free-form card with typed element array
 *   data-grid        — table from graph_data datasets or 2-col element grid
 *   vector-graphics  — minimalist SVG charts (bar / line / radar)
 *   list-container   — numbered monospace list
 */

import type { Widget } from "./types";
import type {
  DynamicElement,
  GraphData,
  StyleOverrides,
  WidgetPayload,
} from "./dynamicSchema";

// ─── Internal helpers ─────────────────────────────────────────────────────────

interface ContentProps {
  payload: WidgetPayload;
  style:   StyleOverrides;
}

function asPayload(data: Record<string, unknown>): WidgetPayload {
  return (data.payload ?? { elements: [] }) as WidgetPayload;
}

function asStyle(data: Record<string, unknown>): StyleOverrides {
  const raw = data.style_overrides as Partial<StyleOverrides> | undefined;
  return { variant: raw?.variant ?? "bordered", accent_color: raw?.accent_color };
}

// ─── Element renderer ─────────────────────────────────────────────────────────

function El({ el }: { el: DynamicElement }) {
  switch (el.type) {
    case "header":
      return (
        <div className="font-mono text-lg font-bold leading-tight text-zinc-100">
          {el.value}
        </div>
      );
    case "metric":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-mono font-bold leading-none text-white" style={{ fontSize: 40 }}>
            {el.value}
          </span>
          {el.label && (
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
              {el.label}
            </span>
          )}
        </div>
      );
    case "code":
      return (
        <pre className="overflow-auto rounded bg-zinc-900/80 p-2 font-mono text-[10px] leading-relaxed text-emerald-400">
          <code>{el.value}</code>
        </pre>
      );
    case "tag":
      return (
        <span
          className="inline-block rounded px-2 py-0.5 font-mono text-[9px]"
          style={
            el.color
              ? { color: el.color, outline: `1px solid ${el.color}`, background: `${el.color}20` }
              : { color: "#6366f1", outline: "1px solid #6366f1", background: "rgba(99,102,241,0.10)" }
          }
        >
          {el.value}
        </span>
      );
    default: // "text"
      return (
        <p className="font-mono text-xs leading-relaxed text-zinc-400">{el.value}</p>
      );
  }
}

// ─── SVG Charts ───────────────────────────────────────────────────────────────

const VW = 200;
const PAD = { l: 24, r: 8, t: 8, b: 22 };

function accentColor(style: StyleOverrides) {
  return style.accent_color ?? "#6366f1";
}

function BarChart({ data, style }: { data: GraphData; style: StyleOverrides }) {
  const ds = data.datasets[0];
  if (!ds?.values.length) return null;
  const VH = 120;
  const { l, r, t, b } = PAD;
  const cW = VW - l - r;
  const cH = VH - t - b;
  const maxVal = Math.max(...ds.values, 1);
  const n = ds.values.length;
  const gap = cW / n;
  const bW = gap * 0.55;
  const col = accentColor(style);

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={l} y1={t + cH * (1 - f)} x2={l + cW} y2={t + cH * (1 - f)}
          stroke="#27272a" strokeWidth="0.4" />
      ))}
      <line x1={l} y1={t} x2={l} y2={t + cH} stroke="#3f3f46" strokeWidth="0.5" />
      {ds.values.map((v, i) => {
        const bH = (v / maxVal) * cH;
        const x = l + i * gap + (gap - bW) / 2;
        const y = t + cH - bH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bW} height={bH} fill={col} fillOpacity="0.75" rx="0.5" />
            <text x={x + bW / 2} y={y - 2} textAnchor="middle" fontSize="4.5" fill="#71717a" fontFamily="monospace">{v}</text>
            {data.labels[i] && (
              <text x={x + bW / 2} y={t + cH + 9} textAnchor="middle" fontSize="4.5" fill="#52525b" fontFamily="monospace">
                {data.labels[i]}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ data, style }: { data: GraphData; style: StyleOverrides }) {
  const ds = data.datasets[0];
  if (!ds?.values.length) return null;
  const VH = 120;
  const { l, r, t, b } = PAD;
  const cW = VW - l - r;
  const cH = VH - t - b;
  const maxVal = Math.max(...ds.values, 1);
  const n = ds.values.length;
  const col = accentColor(style);

  const pts = ds.values.map((v, i) => ({
    x: l + (n > 1 ? (i / (n - 1)) * cW : cW / 2),
    y: t + cH - (v / maxVal) * cH,
  }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line key={f} x1={l} y1={t + cH * (1 - f)} x2={l + cW} y2={t + cH * (1 - f)}
          stroke="#1c1c1f" strokeWidth="0.5" strokeDasharray="3 2" />
      ))}
      <line x1={l} y1={t} x2={l} y2={t + cH} stroke="#3f3f46" strokeWidth="0.4" />
      <line x1={l} y1={t + cH} x2={l + cW} y2={t + cH} stroke="#3f3f46" strokeWidth="0.4" />
      <polygon
        points={`${l},${t + cH} ${polyline} ${pts[pts.length - 1].x},${t + cH}`}
        fill={col} fillOpacity="0.07"
      />
      <polyline points={polyline} fill="none" stroke={col} strokeWidth="1.4" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="2" fill={col} />
          {data.labels[i] && (
            <text x={p.x} y={t + cH + 9} textAnchor="middle" fontSize="4.5" fill="#52525b" fontFamily="monospace">
              {data.labels[i]}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

function RadarChart({ data, style }: { data: GraphData; style: StyleOverrides }) {
  const labels = data.labels;
  const n = labels.length;
  if (n < 3) return null;
  const ds = data.datasets[0];
  if (!ds?.values.length) return null;

  const VH = 130;
  const cx = VW / 2;
  const cy = VH / 2;
  const R = Math.min(cx, cy) - 18;
  const col = accentColor(style);
  const A0 = -Math.PI / 2;

  const vertex = (i: number, scale = 1) => ({
    x: cx + R * scale * Math.cos(A0 + (2 * Math.PI * i) / n),
    y: cy + R * scale * Math.sin(A0 + (2 * Math.PI * i) / n),
  });

  const maxVal = Math.max(...ds.values, 1);
  const dataPoints = ds.values.map((v, i) => vertex(i, v / maxVal));
  const dataPoly = dataPoints.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {[0.33, 0.67, 1].map((s) => (
        <polygon key={s}
          points={Array.from({ length: n }, (_, i) => { const v = vertex(i, s); return `${v.x},${v.y}`; }).join(" ")}
          fill="none" stroke="#27272a" strokeWidth="0.5"
        />
      ))}
      {Array.from({ length: n }, (_, i) => {
        const v = vertex(i);
        return <line key={i} x1={cx} y1={cy} x2={v.x} y2={v.y} stroke="#3f3f46" strokeWidth="0.4" />;
      })}
      <polygon points={dataPoly} fill={col} fillOpacity="0.15" stroke={col} strokeWidth="1.3" />
      {dataPoints.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="1.8" fill={col} />)}
      {Array.from({ length: n }, (_, i) => {
        const v = vertex(i, 1.28);
        return (
          <text key={i} x={v.x} y={v.y + 1.5} textAnchor="middle" dominantBaseline="middle"
            fontSize="4.5" fill="#71717a" fontFamily="monospace">
            {labels[i]}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Widget content components ────────────────────────────────────────────────

const sectionLabel: React.CSSProperties = {
  fontSize: 9,
  borderBottom: "1px solid #27272a",
  paddingBottom: 6,
  marginBottom: 8,
};

function CustomCardContent({ payload }: ContentProps) {
  return (
    <div className="flex h-full flex-col gap-2 overflow-hidden p-3">
      {payload.title && (
        <div className="shrink-0 font-mono uppercase tracking-widest text-zinc-600" style={sectionLabel}>
          {payload.title}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2.5 overflow-auto">
        {payload.elements.map((el, i) => <El key={i} el={el} />)}
      </div>
    </div>
  );
}

function DataGridContent({ payload }: ContentProps) {
  const { graph_data, elements, title } = payload;

  if (graph_data?.datasets.length) {
    const { labels, datasets } = graph_data;
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {title && (
          <div className="shrink-0 font-mono uppercase tracking-widest text-zinc-600" style={{ ...sectionLabel, padding: "6px 10px" }}>
            {title}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-zinc-900 p-1.5 text-left font-mono text-[9px] text-zinc-700" />
                {labels.map((l, i) => (
                  <th key={i} className="border-b border-zinc-900 p-1.5 text-right font-mono text-[9px] text-zinc-600">{l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {datasets.map((ds, i) => (
                <tr key={i} className="border-b border-zinc-900/60">
                  <td className="p-1.5 font-mono text-[10px] text-zinc-500">{ds.label}</td>
                  {ds.values.map((v, j) => (
                    <td key={j} className="p-1.5 text-right font-mono text-[10px] tabular-nums text-zinc-200">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full grid-cols-2 gap-1.5 overflow-auto p-2">
      {elements.map((el, i) => (
        <div key={i} className="rounded border border-zinc-800/60 p-2">
          <El el={el} />
        </div>
      ))}
    </div>
  );
}

function VectorGraphicsContent({ payload, style }: ContentProps) {
  const { graph_data, title, elements } = payload;
  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      {title && (
        <div className="shrink-0 font-mono uppercase tracking-widest text-zinc-600" style={{ fontSize: 9, marginBottom: 6 }}>
          {title}
        </div>
      )}
      {elements.length > 0 && (
        <div className="shrink-0 flex flex-wrap gap-2 mb-2">
          {elements.map((el, i) => <El key={i} el={el} />)}
        </div>
      )}
      <div className="min-h-0 flex-1">
        {graph_data ? (
          graph_data.type === "bar"   ? <BarChart   data={graph_data} style={style} /> :
          graph_data.type === "line"  ? <LineChart  data={graph_data} style={style} /> :
          graph_data.type === "radar" ? <RadarChart data={graph_data} style={style} /> :
          null
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[10px] text-zinc-800">
            [ NO CHART DATA ]
          </div>
        )}
      </div>
    </div>
  );
}

function ListContainerContent({ payload }: ContentProps) {
  const { elements, title } = payload;
  return (
    <div className="flex h-full flex-col overflow-hidden p-3">
      {title && (
        <div className="shrink-0 font-mono uppercase tracking-widest text-zinc-600" style={sectionLabel}>
          {title}
        </div>
      )}
      <ol className="flex flex-1 flex-col gap-2 overflow-auto">
        {elements.map((el, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <span className="shrink-0 select-none font-mono text-[9px] text-zinc-700 pt-0.5 tabular-nums">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="min-w-0 flex-1"><El el={el} /></div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FallbackContent({ payload, originalType }: ContentProps & { originalType: string }) {
  return (
    <div className="flex h-full flex-col overflow-hidden p-3 gap-2">
      <div className="shrink-0 flex items-center gap-2">
        {payload.title && (
          <span className="font-mono text-xs font-semibold text-zinc-300">{payload.title}</span>
        )}
        <span className="ml-auto font-mono text-[8px] text-zinc-700 rounded px-1.5 py-0.5" style={{ background: "#0c0c0e" }}>
          {originalType}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-auto">
        {payload.elements.length > 0
          ? payload.elements.map((el, i) => <El key={i} el={el} />)
          : payload.title && (
              <p className="font-mono text-xs text-zinc-600">{payload.title}</p>
            )}
      </div>
    </div>
  );
}

// ─── Factory ──────────────────────────────────────────────────────────────────

const KNOWN = new Set(["custom-card", "data-grid", "vector-graphics", "list-container"]);

/**
 * Main entry point — called by the widget registry for all four dynamic types.
 * Reads widget.data.original_type so unknown type strings from Claude hit the
 * fallback renderer rather than a blank screen or a runtime error.
 */
export function DynamicWidgetFactory(widget: Widget): JSX.Element {
  const payload      = asPayload(widget.data);
  const style        = asStyle(widget.data);
  const originalType = (widget.data.original_type as string | undefined) ?? widget.type;

  if (!KNOWN.has(originalType)) {
    return <FallbackContent payload={payload} style={style} originalType={originalType} />;
  }

  switch (originalType) {
    case "data-grid":       return <DataGridContent       payload={payload} style={style} />;
    case "vector-graphics": return <VectorGraphicsContent payload={payload} style={style} />;
    case "list-container":  return <ListContainerContent  payload={payload} style={style} />;
    default:                return <CustomCardContent     payload={payload} style={style} />;
  }
}
