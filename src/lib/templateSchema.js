/**
 * Checks a template JSON before it is saved, so a typo in an uploaded file shows a clear
 * message ("layers[3].size: ...") instead of a broken card later.
 * The shape is documented in src/lib/renderer/types.js.
 */
import { z } from "zod";

const num = z.number().finite();
const colour = z.string().regex(/^(\$role|#[0-9a-fA-F]{6})$/, 'Use a colour like "#2563eb", or "$role" for the role colour');
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a colour like "#2563eb"');
const align = z.enum(["left", "center", "right"]);

const base = {
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/, "Use letters, numbers, - or _ (40 characters at most)"),
  x: num.min(-2000).max(4000),
  y: num.min(-2000).max(4000),
  w: num.min(0).max(4000),
  h: num.min(0).max(4000),
  optional: z.boolean().optional(),
  hideIfEmpty: z.string().max(40).optional(),
};
const text = z.string().max(300);

const Layer = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("rect"), fill: colour, radius: num.min(0).max(2000).optional() }).strict(),
  z
    .object({
      ...base,
      type: z.literal("text"),
      text,
      font: z.string().max(120),
      size: num.min(4).max(400),
      minSize: num.min(4).max(400).optional(),
      weight: z.number().int().min(100).max(900).optional(),
      color: colour,
      align: align.optional(),
      maxLines: z.number().int().min(1).max(10).optional(),
      lineHeight: num.min(0.8).max(3).optional(),
      uppercase: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("image"),
      src: text,
      fit: z.enum(["contain", "cover"]),
      shape: z.enum(["rect", "circle"]).optional(),
      fallback: z.enum(["initials", "none"]).optional(),
      align: align.optional(),
    })
    .strict(),
  z.object({ ...base, type: z.literal("qr"), value: text }).strict(),
  z
    .object({
      ...base,
      type: z.literal("badge"),
      text,
      fill: colour,
      color: colour,
      size: num.min(4).max(400),
      font: z.string().max(120).optional(),
      weight: z.number().int().min(100).max(900).optional(),
      radius: num.min(0).max(2000).optional(),
    })
    .strict(),
]);

export const TemplateSchema = z
  .object({
    id: base.id,
    name: z.string().trim().min(1, "Give the template a name").max(60),
    version: z.literal(1).optional(),
    canvas: z.object({ width: z.number().int().min(100).max(2000), height: z.number().int().min(100).max(3000), background: hex }).strict(),
    roleColors: z.record(z.string().min(1).max(40), hex),
    layers: z.array(Layer).min(1, "A template needs at least one layer").max(60),
  })
  .strict()
  .superRefine((t, ctx) => {
    const seen = new Set();
    t.layers.forEach((l, i) => {
      if (seen.has(l.id)) ctx.addIssue({ code: "custom", path: ["layers", i, "id"], message: `"${l.id}" is used twice. Every layer needs its own id.` });
      seen.add(l.id);
    });
  });

/** -> { ok: true, data } or { ok: false, errors: ["layers[2].size: ...", ...] } (at most 8) */
export function validateTemplate(json) {
  const r = TemplateSchema.safeParse(json);
  if (r.success) return { ok: true, data: r.data };
  const errors = r.error.issues.slice(0, 8).map((i) => {
    const path = i.path.map((p, k) => (typeof p === "number" ? `[${p}]` : k === 0 ? p : `.${p}`)).join("");
    return path ? `${path}: ${i.message}` : i.message;
  });
  return { ok: false, errors };
}