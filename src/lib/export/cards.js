/**
 * Server only. Builds export-ready SVG cards: the design the user chose in the
 * editor + one person's data, with logos and photos embedded.
 */
import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";
import { renderCard } from "@/lib/renderer/renderCard";
import { applyFields, cardData, personToCard, samplePerson } from "@/lib/cardData";
import { applyConfig, normalizeConfig } from "@/lib/editorConfig";
import { applyBrand } from "@/lib/brand";
import { kitForProject } from "@/lib/brandKits";
import { toDataUri } from "./assets";

export const PX_PER_MM = 10; // the card canvas is 540 x 856 px = 54 x 85.6 mm (CR80 ID card)
export const PART_SIZE = 50; // cards per PDF file, keeps memory low on a small server
export const BLEED_MM = 3; // artwork runs this far past the cut line, so a slightly off cut shows no white edge
export const MARK_LEN_MM = 3; // crop marks sit outside the bleed and are this long

/** Load the project, its event details and the design the user chose (or the first one if none was chosen). */
export async function loadExportContext(projectId) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project) return { error: "Project not found.", status: 404 };
  const checked = validateEventData(project.eventData);
  if (!checked.ok) return { error: "Finish the event details first.", status: 409 };

  let draft = await db.draft.findFirst({ where: { projectId, selected: true }, include: { template: true } });
  if (!draft) draft = await db.draft.findFirst({ where: { projectId }, include: { template: true } });
  if (!draft) return { error: "Choose a design first.", status: 409 };

  const kit = await kitForProject(project);
  const design = applyConfig(applyFields(applyBrand(draft.template.json, kit), checked.data.fieldsToShow ?? []), normalizeConfig(draft.config));
  return { project, eventData: checked.data, design };
}

/** Page size in mm for one card: the plain card, or the card + bleed + room for crop marks. */
export function pageSizeMm(canvas, print) {
  const margin = print ? 2 * (BLEED_MM + MARK_LEN_MM) : 0;
  return { widthMm: canvas.width / PX_PER_MM + margin, heightMm: canvas.height / PX_PER_MM + margin };
}

/** Print version of a design: shapes that touch the card edge are stretched into the bleed. */
export function withBleed(design, bleedPx) {
  const { width: W, height: H } = design.canvas;
  const layers = design.layers.map((l) => {
    if (l.type !== "rect") return l;
    let { x, y, w, h } = l;
    if (x <= 0) { w += bleedPx - x; x = -bleedPx; }
    if (x + w >= W) w = W + bleedPx - x;
    if (y <= 0) { h += bleedPx - y; y = -bleedPx; }
    if (y + h >= H) h = H + bleedPx - y;
    return { ...l, x, y, w, h };
  });
  return { ...design, layers };
}

/**
 * Plain card svg -> print svg: background and edge shapes cover the bleed, and
 * four pairs of crop marks are drawn outside it. Relies on the renderer's output
 * (viewBox "0 0 W H" and a full-size background rect).
 */
export function toPrintSvg(svg, canvas, { marks = true } = {}) {
  const { width: W, height: H } = canvas;
  const B = BLEED_MM * PX_PER_MM;
  const M = (marks ? BLEED_MM + MARK_LEN_MM : BLEED_MM) * PX_PER_MM;
  const viewBox = `viewBox="0 0 ${W} ${H}"`;
  const bg = '<rect width="100%" height="100%"';
  if (!svg.includes(viewBox) || !svg.includes(bg)) {
    console.warn("toPrintSvg: unexpected renderer output, bleed and crop marks were not added.");
    return svg;
  }
  const corners = [[0, 0, -1, -1], [W, 0, 1, -1], [0, H, -1, 1], [W, H, 1, 1]];
  const d = corners
    .map(([cx, cy, sx, sy]) => `M${cx + sx * B} ${cy}H${cx + sx * M}M${cx} ${cy + sy * B}V${cy + sy * M}`)
    .join("");
  const markPath = marks ? `<path d="${d}" fill="none" stroke="#000000" stroke-width="0.9"/>` : "";
  return svg
    .replace(viewBox, `viewBox="${-M} ${-M} ${W + 2 * M} ${H + 2 * M}"`)
    .replace(bg, `<rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}"`)
    .replace(/(<svg[^>]*>)/, `$1<clipPath id="clip-bleedbox"><rect x="${-B}" y="${-B}" width="${W + 2 * B}" height="${H + 2 * B}"/></clipPath><g clip-path="url(#clip-bleedbox)">`)
    .replace(/<\/svg>\s*$/, `</g>\n  ${markPath}\n</svg>`);
}

/**
 * A brand kit puts the logo's real link into the design (not a {{placeholder}}),
 * so those links are embedded here too. Without this, the PDF could not find them.
 */
async function embedLayerImages(design, cache, notes) {
  const layers = await Promise.all(
    design.layers.map(async (l) => {
      if (l.type !== "image" || !l.src || l.src.includes("{{") || l.src.startsWith("data:")) return l;
      const res = await toDataUri(l.src, cache);
      if (res.uri) return { ...l, src: res.uri };
      notes.push(`A logo could not be loaded (${res.error}).`);
      return { ...l, src: "" };
    })
  );
  return { ...design, layers };
}

/** One card -> { svg, notes[] }. `person` is a saved Person row, or null for a sample card. */
export async function buildCard(ctx, person, { index = 0, sampleRole, photoCache = new Map(), print = false, marks = true } = {}) {
  const notes = [];
  const who = person ? personToCard(person) : samplePerson(sampleRole ?? Object.keys(ctx.eventData.roles)[0]);
  const data = cardData(ctx.eventData, who);

  for (const key of ["logoLeft", "logoRight", "photo"]) {
    if (!data[key]) continue;
    const res = await toDataUri(data[key], photoCache);
    if (res.uri) data[key] = res.uri;
    else {
      data[key] = "";
      if (key === "photo") notes.push(`${who.name}: the photo could not be loaded (${res.error}), so initials are used.`);
      else notes.push(`A logo could not be loaded (${res.error}).`);
    }
  }

  const sized = print ? withBleed(ctx.design, BLEED_MM * PX_PER_MM) : ctx.design;
  const design = await embedLayerImages(sized, photoCache, notes);
  const { svg, warnings } = renderCard(design, data);
  for (const w of warnings) {
    if (w.kind === "overflow") notes.push(`${who.name}: some text was shortened to fit.`);
    if (w.kind === "missing" && w.field === "qrUrl") notes.push(`${who.name}: no QR code, because there is no ID.`);
  }
  // Many cards in one page must not share clip-path ids.
  const unique = svg.replace(/id="clip-/g, `id="k${index}_clip-`).replace(/url\(#clip-/g, `url(#k${index}_clip-`);
  return { svg: print ? toPrintSvg(unique, ctx.design.canvas, { marks }) : unique, notes };
}

/** A stand-alone .svg file: real millimetre size (taken from its viewBox), so design tools and printers open it at the right size. */
export function standaloneSvg(svg) {
  const m = /viewBox="(-?[\d.]+) (-?[\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  const size = m ? ` width="${Number(m[3]) / PX_PER_MM}mm" height="${Number(m[4]) / PX_PER_MM}mm"` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>\n` + svg.replace("<svg ", `<svg${size} `);
}

/** "Hackathon 2026 / Aarav Sharma" -> "hackathon-2026-aarav-sharma" */
export function fileSlug(...parts) {
  const s = parts.filter(Boolean).join(" ").normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").toLowerCase();
  return s.slice(0, 80) || "cards";
}