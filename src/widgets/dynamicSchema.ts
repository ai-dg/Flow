/**
 * Zod schema + TypeScript types for the dynamic canvas response format.
 *
 * Claude outputs widgets as a flat dictionary (Record<id, decl>) instead of
 * an array. This lets the LLM freely compose any visual with full schema
 * safety enforced by Zod at the boundary — before we attempt to render anything.
 *
 * .catch() on every enum makes the schema "permissive-on-unknown":
 *   • Unknown type strings fall back to "custom-card"
 *   • Unknown variants fall back to "bordered"
 *   • Unknown chart types fall back to "bar"
 * This means the renderer never sees an unrecognised enum value.
 */

import { z } from "zod";

// ── Sub-element ───────────────────────────────────────────────────────────────

export const dynamicElementSchema = z.object({
  /** Visual role of this atomic piece of content. */
  type:  z.enum(["header", "text", "metric", "code", "tag"]).catch("text"),
  value: z.string().default(""),
  /** For "metric" — explanatory label below the number. */
  label: z.string().optional(),
  /** For "tag" — hex or rgba badge color. */
  color: z.string().optional(),
});

// ── Chart ─────────────────────────────────────────────────────────────────────

export const graphDatasetSchema = z.object({
  label:  z.string().default(""),
  values: z.array(z.number()).default([]),
});

export const graphDataSchema = z.object({
  type:     z.enum(["bar", "line", "radar"]).catch("bar"),
  labels:   z.array(z.string()).default([]),
  datasets: z.array(graphDatasetSchema).default([]),
});

// ── Widget payload ────────────────────────────────────────────────────────────

export const widgetPayloadSchema = z.object({
  title:      z.string().optional(),
  elements:   z.array(dynamicElementSchema).default([]),
  graph_data: graphDataSchema.optional(),
});

// ── Style overrides ───────────────────────────────────────────────────────────

export const styleOverridesSchema = z
  .object({
    variant:      z.enum(["minimal-ascii", "bordered", "dashed"]).catch("bordered"),
    accent_color: z.string().optional(),
  })
  .default({ variant: "bordered" });

// ── Single widget declaration ─────────────────────────────────────────────────

export const dynamicWidgetDeclSchema = z.object({
  /** Widget type. Unknown values are caught by the factory and rendered as custom-card. */
  type:            z.string().default("custom-card"),
  position: z.object({
    top:    z.string().default("10%"),
    left:   z.string().default("5%"),
    width:  z.string().default("35%"),
    height: z.string().default("35%"),
  }).default({}),
  style_overrides: styleOverridesSchema,
  payload:         widgetPayloadSchema.default({}),
});

// ── Full Claude response ──────────────────────────────────────────────────────
// `widgets` is a Record (dictionary), NOT an array.
// That is the structural signal that distinguishes this format from the legacy one.

export const dynamicCanvasResponseSchema = z.object({
  speech:                    z.string().optional(),
  reasoning_canvas_strategy: z.string().optional(),
  total_widgets:             z.number().optional(),
  layout_strategy:           z.string().optional(),
  /** Optional camera action — validated loosely, dispatched by the existing camera handler. */
  camera:  z.unknown().optional(),
  widgets: z.record(z.string(), dynamicWidgetDeclSchema),
});

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type DynamicElement       = z.infer<typeof dynamicElementSchema>;
export type GraphDataset         = z.infer<typeof graphDatasetSchema>;
export type GraphData            = z.infer<typeof graphDataSchema>;
export type StyleOverrides       = z.infer<typeof styleOverridesSchema>;
export type WidgetPayload        = z.infer<typeof widgetPayloadSchema>;
export type DynamicWidgetDecl    = z.infer<typeof dynamicWidgetDeclSchema>;
export type DynamicCanvasPayload = z.infer<typeof dynamicCanvasResponseSchema>;

// ── Format detector ───────────────────────────────────────────────────────────

/**
 * Returns true when the parsed JSON has `widgets` as a dictionary rather than
 * an array — the structural signal for the new dynamic canvas format.
 */
export function isDynamicCanvasFormat(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    r.widgets != null &&
    typeof r.widgets === "object" &&
    !Array.isArray(r.widgets)
  );
}
