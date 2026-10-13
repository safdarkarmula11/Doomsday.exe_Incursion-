/**
 * Brand kit = the look of an event that is NOT the layout: logos, role colours, fonts.
 * Pure helpers (safe to use in the browser and on the server).
 *
 * Stored in the BrandKit table (Prisma) as:
 *   logos:      { left: { url, label }, right: { url, label } }   url = site path, https link, or a base64 "data:image/..." (from an upload)
 *   roleColors: { participant: "#2563eb", ... }                   overrides the design's own role colours
 *   fonts:      { heading: "...", body: "..." }                   "" = keep the design's own font
 *   colors:     {}                                                (unused for now)
 *
 * applyBrand(template, kit) puts the kit on a template, BEFORE the editor's own changes,
 * so what the user changes in the editor always wins over the brand kit.
 */
import { z } from "zod";
import { FONT_OPTIONS } from "./editorConfig";

export const MAX_LOGO_BYTES = 300_000;
export const MAX_LOGO_CHARS = 450_000; // 300 KB as base64
const HEX = /^#[0-9a-fA-F]{6}$/;
const FONT_VALUES = ["", ...FONT_OPTIONS.map((f) => f.value)];
const HEADING_LAYERS = ["event-name", "name"]; // these get the heading font, every other text gets the body font
const LOGO_OK = /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,[A-Za-z0-9+/=]+|https?:\/\/\S+|\/(?!\/)\S+)$/i;

const logo = z.object({
  url: z.string().trim().min(1, "Add a logo file or a link").max(MAX_LOGO_CHARS, "That logo is too big (300 KB at most)").refine((v) => LOGO_OK.test(v), "Use a PNG, JPG, WebP or SVG file, or a web link"),
  label: z.string().trim().max(60).default(""),
});
const font = z.string().refine((v) => FONT_VALUES.includes(v), "Pick a font from the list");

export const BrandKitSchema = z
  .object({
    name: z.string().trim().min(1, "Give the brand kit a name").max(80),
    logos: z.object({ left: logo, right: logo }),
    roleColors: z.record(z.string().trim().min(1).max(40), z.string().regex(HEX, "Use a colour like #2563eb")).default({}),
    fonts: z.object({ heading: font, body: font }).default({ heading: "", body: "" }),
  })
  .strict();

/** The kit that is always there: both logos from /public/logos, nothing else changed. */
export const DEFAULT_KIT = {
  name: "ACM NIT Surat × SVNIT",
  logos: {
    left: { url: "/logos/ACMLogo.png", label: "ACM NIT Surat" },
    right: { url: "/logos/NIT_Surat_Logo.svg.webp", label: "SVNIT" },
  },
  roleColors: {},
  fonts: { heading: "", body: "" },
};

/** A BrandKit row (or anything half-broken) -> a safe kit object. Never throws. */
export function parseKit(row) {
  const logos = row?.logos ?? {};
  const pick = (side) => ({ url: logos[side]?.url || DEFAULT_KIT.logos[side].url, label: logos[side]?.label ?? DEFAULT_KIT.logos[side].label });
  const colours = {};
  for (const [role, c] of Object.entries(row?.roleColors ?? {})) if (typeof c === "string" && HEX.test(c)) colours[role] = c.toLowerCase();
  const f = row?.fonts ?? {};
  return {
    id: row?.id ?? null,
    name: row?.name || DEFAULT_KIT.name,
    isDefault: Boolean(row?.isDefault),
    logos: { left: pick("left"), right: pick("right") },
    roleColors: colours,
    fonts: { heading: FONT_VALUES.includes(f.heading) ? f.heading : "", body: FONT_VALUES.includes(f.body) ? f.body : "" },
  };
}

/** template + brand kit -> the template to draw. */
export function applyBrand(template, kit) {
  if (!kit) return template;
  const layers = template.layers.map((l) => {
    if (l.type === "image" && l.src === "{{logoLeft}}") return { ...l, src: kit.logos.left.url };
    if (l.type === "image" && l.src === "{{logoRight}}") return { ...l, src: kit.logos.right.url };
    if (l.type === "text" || l.type === "badge") {
      const wanted = HEADING_LAYERS.includes(l.id) ? kit.fonts.heading : kit.fonts.body;
      if (wanted) return { ...l, font: wanted };
    }
    return l;
  });
  return { ...template, roleColors: { ...template.roleColors, ...kit.roleColors }, layers };
}