import { db } from "@/lib/db";
import { loadExportContext, buildCard, standaloneSvg, fileSlug, pageSizeMm, PART_SIZE } from "@/lib/export/cards";
import { renderPdf, renderPng, renderHtmlPdf, ExportEngineError } from "@/lib/export/browser";
import { computeLayout, planSheets, sheetsHtml, PAPERS } from "@/lib/export/sheets";
import { setPngDpi } from "@/lib/export/png";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";
const TYPES = { svg: "image/svg+xml", png: "image/png", pdf: "application/pdf" };
const ORDER = [{ role: "asc" }, { name: "asc" }, { id: "asc" }];

function fail(error, status = 400) {
  return Response.json({ error }, { status });
}

function send(body, format, filename, notes) {
  const headers = {
    "Content-Type": TYPES[format],
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
  };
  if (notes.length > 0) headers["X-Notes"] = encodeURIComponent(JSON.stringify(notes.slice(0, 8).map((n) => n.slice(0, 140))));
  return new Response(body, { headers });
}

/**
 * GET /api/projects/:id/export
 *   ?format=pdf|png|svg          (default pdf)
 *   ?person=<id> | sample        one card (default: a sample card; ?role= picks the sample's role)
 *   ?all=1&role=&part=1          PDF with one card per page for everyone (PART_SIZE per file)
 *   ?print=1                     PDF and SVG: add a 3 mm bleed and crop marks
 *   ?dpi=300                     PNG only: 72 to 1000 (default 300)
 *   ?sheet=1&paper=a4|a3&orientation=auto|portrait|landscape&bleed=1&byrole=1&role=&part=1
 *                                PDF print sheets: many cards per page. Add &info=1 to get the layout as JSON.
 */
export async function GET(request, { params }) {
  const { id } = await params;
  const q = new URL(request.url).searchParams;
  const format = q.get("format") ?? "pdf";
  if (!TYPES[format]) return fail("Choose PDF, PNG or SVG.");
  const wantsAll = q.get("all") === "1";
  const wantsSheet = q.get("sheet") === "1";
  if ((wantsAll || wantsSheet) && format !== "pdf") return fail("Exporting many cards is only available as PDF.");

  try {
    const ctx = await loadExportContext(id);
    if (ctx.error) return fail(ctx.error, ctx.status);
    const { canvas } = ctx.design;
    const print = q.get("print") === "1" && format !== "png";
    const { widthMm, heightMm } = pageSizeMm(canvas, print);
    const printTag = print ? "-print" : "";
    const eventSlug = fileSlug(ctx.eventData.eventName);
    const photoCache = new Map();

    // ---- print sheets: many cards per A4 / A3 page ----
    if (wantsSheet) {
      const paper = q.get("paper") ?? "a4";
      if (!PAPERS[paper]) return fail("Choose A4 or A3.");
      const orientation = ["auto", "portrait", "landscape"].includes(q.get("orientation")) ? q.get("orientation") : "auto";
      const bleed = q.get("bleed") === "1";
      const byRole = q.get("byrole") === "1";
      const role = q.get("role");
      const layout = computeLayout(canvas, { paper, orientation, bleed });
      if (layout.perSheet < 1) return fail("The card does not fit on that paper.");

      const people = await db.person.findMany({ where: { projectId: id, ...(role ? { role } : {}) }, orderBy: ORDER });
      if (people.length === 0) return fail("There are no people to export. Add people first.", 404);
      const pages = planSheets(people, layout, byRole);
      const parts = Math.ceil(pages.length / layout.pagesPerFile);
      if (q.get("info") === "1") {
        return Response.json({
          perSheet: layout.perSheet,
          cols: layout.cols,
          rows: layout.rows,
          orientation: layout.orientation,
          sheets: pages.length,
          pagesPerFile: layout.pagesPerFile,
          parts,
        });
      }

      const part = Math.min(parts, Math.max(1, Number(q.get("part")) || 1));
      const first = (part - 1) * layout.pagesPerFile;
      const slice = pages.slice(first, first + layout.pagesPerFile);
      const notes = [];
      let index = 0;
      const rendered = [];
      for (const page of slice) {
        const svgs = [];
        for (const person of page.people) {
          const card = await buildCard(ctx, person, { index: index++, photoCache, print: bleed, marks: false });
          svgs.push(card.svg);
          notes.push(...card.notes);
        }
        rendered.push({ role: page.role, svgs });
      }
      const html = sheetsHtml(rendered, layout, { title: ctx.eventData.eventName, firstPage: first + 1, totalPages: pages.length });
      const pdf = await renderHtmlPdf(html);
      const label = parts > 1 ? `-part-${part}-of-${parts}` : "";
      return send(pdf, "pdf", `${eventSlug}${role ? "-" + fileSlug(role) : ""}-sheets-${paper}${bleed ? "-bleed" : ""}${byRole ? "-by-role" : ""}${label}.pdf`, notes);
    }

    // ---- everyone: one PDF, one card per page ----
    if (wantsAll) {
      const role = q.get("role");
      const where = { projectId: id, ...(role ? { role } : {}) };
      const total = await db.person.count({ where });
      if (total === 0) return fail("There are no people to export. Add people first.", 404);
      const parts = Math.ceil(total / PART_SIZE);
      const part = Math.min(parts, Math.max(1, Number(q.get("part")) || 1));
      const people = await db.person.findMany({ where, orderBy: ORDER, skip: (part - 1) * PART_SIZE, take: PART_SIZE });
      const notes = [];
      const svgs = [];
      for (let i = 0; i < people.length; i++) {
        const card = await buildCard(ctx, people[i], { index: i, photoCache, print });
        svgs.push(card.svg);
        notes.push(...card.notes);
      }
      const pdf = await renderPdf(svgs, widthMm, heightMm);
      const label = parts > 1 ? `-part-${part}-of-${parts}` : "";
      return send(pdf, "pdf", `${eventSlug}${role ? "-" + fileSlug(role) : ""}-cards${printTag}${label}.pdf`, notes);
    }

    // ---- one card ----
    const personId = q.get("person");
    let person = null;
    if (personId && personId !== "sample") {
      person = await db.person.findFirst({ where: { id: personId, projectId: id } });
      if (!person) return fail("That person was not found.", 404);
    }
    const role = q.get("role");
    const sampleRole = role && role in ctx.eventData.roles ? role : undefined;
    const card = await buildCard(ctx, person, { sampleRole, photoCache, print });
    const base = (person ? `${eventSlug}-${fileSlug(person.name)}` : `${eventSlug}-sample-card`) + printTag;

    if (format === "svg") return send(standaloneSvg(card.svg), "svg", `${base}.svg`, card.notes);
    if (format === "png") {
      // The card is 54 mm wide, so 254 dots per card pixel-unit gives exactly that many dpi.
      const dpi = Math.min(1000, Math.max(72, Number(q.get("dpi")) || 300));
      const png = await renderPng(card.svg, canvas.width, canvas.height, dpi / 254);
      return send(setPngDpi(png, dpi), "png", `${base}-${Math.round(dpi)}dpi.png`, card.notes);
    }
    const pdf = await renderPdf([card.svg], widthMm, heightMm);
    return send(pdf, "pdf", `${base}.pdf`, card.notes);
  } catch (e) {
    if (e instanceof ExportEngineError) return fail(e.message, 500);
    console.error("Export failed:", e);
    return fail(e?.code?.startsWith?.("P") ? DB_ERROR : "The export failed. Check the PowerShell window for the reason.", 500);
  }
}