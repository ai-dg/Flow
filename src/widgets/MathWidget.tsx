import katex from "katex";
import "katex/dist/katex.min.css";
import type { Widget } from "./types";

function s(v: unknown, fb = ""): string {
  return typeof v === "string" ? v : fb;
}

export const MathWidget = (w: Widget) => {
  const formula = s(w.data.formula);
  const label   = s(w.data.label);
  const display = w.data.display !== false; // block display by default

  let html = "";
  let error = "";
  try {
    html = katex.renderToString(formula, {
      displayMode: display,
      throwOnError: false,
      output: "html",
    });
  } catch (e) {
    error = formula;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {label && (
        <div className="shrink-0 border-b border-zinc-800 pb-2.5">
          <span className="select-none font-mono text-[10px] text-zinc-600">∑ </span>
          <span className="font-mono text-sm font-semibold text-zinc-100">{label}</span>
        </div>
      )}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto px-4">
        {error ? (
          <span className="font-mono text-xs text-zinc-500">{error}</span>
        ) : (
          <div
            className="katex-display-override text-zinc-100"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </div>
    </div>
  );
};
