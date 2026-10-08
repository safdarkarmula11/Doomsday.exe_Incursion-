/**
 * The editor does not copy the template. It saves only what the user CHANGED, as "overrides":
 *   { layers: { "event-name": { size: 40, color: "#ff0000", hidden: true } }, roleColors: { mentor: "#7c3aed" } }
 * applyConfig(template, config) lays those changes over the template. Used by the editor, the drafts page and (later) export.
 */
import { z } from "zod";

export const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
];

/** Which properties the side panel may change, per layer type. */
export const EDITABLE = {
  rect: ["x", "y", "w", "h", "fill"],
  text: ["x", "y", "w", "h", "text", "font", "size", "weight", "align", "color"],
  badge: ["x", "y", "w", "h", "text", "size", "weight", "fill", "color"],
  image: ["x", "y", "w", "h"],
  qr: ["x", "y", "w", "h"],
};

const colorValue = z.string().regex(/^(\$role|#[0-9a-fA-F]{6})$/);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const pos = z.number().finite().min(-2000).max(4000);
const len = z.number().finite().min(1).max(4000);

const LayerOverride = z
  .object({
    x: pos.optional(),
    y: pos.optional(),
    w: len.optional(),
    h: len.optional(),
    size: z.number().finite().min(4).max(400).optional(),
    weight: z.number().int().min(100).max(900).optional(),
    align: z.enum(["left", "center", "right"]).optional(),
    color: colorValue.optional(),
    fill: colorValue.optional(),
    text: z.string().max(200).optional(),
    font: z.string().max(120).optional(),
    hidden: z.boolean().optional(),
  })
  .strict();

export const EditorConfigSchema = z
  .object({
    layers: z.record(z.string().max(60), LayerOverride).default({}),
    roleColors: z.record(z.string().max(40), hex).default({}),
  })
  .strict();

export const EMPTY_CONFIG = { layers: {}, roleColors: {} };

/** Anything unreadable becomes "no changes" instead of crashing a page. */
export function normalizeConfig(config) {
  const r = EditorConfigSchema.safeParse(config ?? {});
  return r.success ? r.data : EMPTY_CONFIG;
}

/** template + overrides -> the template to draw. Hidden layers are removed. */
export function applyConfig(template, config) {
  const cfg = normalizeConfig(config);
  const layers = [];
  for (const l of template.layers) {
    const { hidden, ...changes } = cfg.layers[l.id] ?? {};
    if (hidden) continue;
    const merged = { ...l, ...changes };
    // keep text able to shrink when the user picks a smaller size
    if (changes.size !== undefined && l.type === "text") merged.minSize = Math.min(l.minSize ?? l.size, changes.size);
    layers.push(merged);
  }
  return { ...template, roleColors: { ...template.roleColors, ...cfg.roleColors }, layers };
}

/** "event-name" -> "Event name" */
export function layerLabel(id) {
  const s = id.replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}