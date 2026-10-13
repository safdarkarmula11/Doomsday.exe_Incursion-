/**
 * Print sheets: many cards on one A4 / A3 page, with cut ticks in the margin.
 * Pure functions (no database), so the maths is easy to check.
 *
 * How a sheet is laid out (all sizes in mm):
 *   - Each card sits in a "cell". Without bleed the cell is the card plus a 4 mm
 *     white gap, so cards can be cut apart with scissors.
 *   - With bleed the artwork runs 3 mm past the cut line on every side, and the
 *     cells touch: one cut line on each side of every card, marked by ticks in
 *     the page margin (the way print shops do it).
 */
import { BLEED_MM, PX_PER_MM } from "./cards";

export const PAPERS = { a4: { name: "A4", w: 210, h: 297 }, a3: { name: "A3", w: 297, h: 420 } };
export const MARGIN_MM = 10;
export const GAP_MM = 4; // white gap between cards when there is no bleed
const TICK_START_MM = 1; // a tick starts this far outside the artwork
const TICK_LEN_MM = 3;
const MAX_CARDS_PER_FILE = 100; // keeps each PDF small and quick to make

function gridFor(pageW, pageH, cellW, cellH) {
  const cols = Math.floor((pageW - 2 * MARGIN_MM) / cellW);
  const rows = Math.floor((pageH - 2 * MARGIN_MM) / cellH);
  return { cols: Math.max(0, cols), rows: Math.max(0, rows) };
}

/**
 * @param {{width:number,height:number}} canvas  the card canvas (px, 10 px = 1 mm)
 * @param {{paper:"a4"|"a3", orientation:"auto"|"portrait"|"landscape", bleed:boolean}} opts
 */
export function computeLayout(canvas, { paper = "a4", orientation = "auto", bleed = false } = {}) {
  const sheet = PAPERS[paper] ?? PAPERS.a4;
  const trimW = canvas.width / PX_PER_MM;
  const trimH = canvas.height / PX_PER_MM;
  const b = bleed ? BLEED_MM : 0;
  const g = bleed ? 0 : GAP_MM;
  const cellW = trimW + 2 * b + g;
  const cellH = trimH + 2 * b + g;

  const tryOrientation = (o) => {
    const pageW = o === "landscape" ? sheet.h : sheet.w;
    const pageH = o === "landscape" ? sheet.w : sheet.h;
    return { o, pageW, pageH, ...gridFor(pageW, pageH, cellW, cellH) };
  };
  const portrait = tryOrientation("portrait");
  const landscape = tryOrientation("landscape");
  const chosen =
    orientation === "portrait" ? portrait : orientation === "landscape" ? landscape : landscape.cols * landscape.rows > portrait.cols * portrait.rows ? landscape : portrait;

  const perSheet = chosen.cols * chosen.rows;
  return {
    paperName: sheet.name,
    orientation: chosen.o,
    pageW: chosen.pageW,
    pageH: chosen.pageH,
    cols: chosen.cols,
    rows: chosen.rows,
    perSheet,
    trimW,
    trimH,
    bleed: b,
    gap: g,
    cellW,
    cellH,
    // top-left corner of the whole grid, centred on the page
    ox: (chosen.pageW - chosen.cols * cellW) / 2,
    oy: (chosen.pageH - chosen.rows * cellH) / 2,
    pagesPerFile: Math.max(1, Math.floor(MAX_CARDS_PER_FILE / Math.max(1, perSheet))),
  };
}

/** People (already sorted) -> pages, each a list of up to perSheet people. */
export function planSheets(people, layout, newSheetPerRole = false) {
  if (layout.perSheet < 1) return [];
  const groups = newSheetPerRole
    ? [...people.reduce((m, p) => m.set(p.role, [...(m.get(p.role) ?? []), p]), new Map())].map(([role, list]) => ({ role, list }))
    : [{ role: "", list: people }];
  const pages = [];
  for (const { role, list } of groups) {
    for (let i = 0; i < list.length; i += layout.perSheet) pages.push({ role, people: list.slice(i, i + layout.perSheet) });
  }
  return pages;
}

const n = (v) => Math.round(v * 1000) / 1000;

/** Cut ticks in the margins, one per trim line. Returns an svg path "d" in mm. */
export function tickPath(L) {
  const { cols, rows, ox, oy, cellW, cellH, gap, bleed, trimW, trimH } = L;
  const top = oy + gap / 2 - TICK_START_MM;
  const bottom = oy + rows * cellH - gap / 2 + TICK_START_MM;
  const left = ox + gap / 2 - TICK_START_MM;
  const right = ox + cols * cellW - gap / 2 + TICK_START_MM;
  let d = "";
  for (let c = 0; c < cols; c++) {
    const x0 = ox + c * cellW + gap / 2 + bleed; // left trim edge of this column
    for (const x of [x0, x0 + trimW]) d += `M${n(x)} ${n(top)}V${n(top - TICK_LEN_MM)}M${n(x)} ${n(bottom)}V${n(bottom + TICK_LEN_MM)}`;
  }
  for (let r = 0; r < rows; r++) {
    const y0 = oy + r * cellH + gap / 2 + bleed;
    for (const y of [y0, y0 + trimH]) d += `M${n(left)} ${n(y)}H${n(left - TICK_LEN_MM)}M${n(right)} ${n(y)}H${n(right + TICK_LEN_MM)}`;
  }
  return d;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * @param {{ role: string, svgs: string[] }[]} pages   svgs are the cards of that page, in reading order
 * @param {string} title  small label printed in the bottom margin
 */
export function sheetsHtml(pages, L, { title = "", firstPage = 1, totalPages = pages.length } = {}) {
  const ticks = tickPath(L);
  const artW = L.trimW + 2 * L.bleed;
  const artH = L.trimH + 2 * L.bleed;
  const body = pages
    .map((page, i) => {
      const cards = page.svgs
        .map((svg, k) => {
          const col = k % L.cols;
          const row = Math.floor(k / L.cols);
          const x = L.ox + col * L.cellW + L.gap / 2;
          const y = L.oy + row * L.cellH + L.gap / 2;
          return `<div class="c" style="left:${n(x)}mm;top:${n(y)}mm">${svg}</div>`;
        })
        .join("");
      const label = [title, page.role, `Sheet ${firstPage + i} of ${totalPages}`].filter(Boolean).join("  ·  ");
      return (
        `<div class="p">${cards}` +
        `<svg class="m" viewBox="0 0 ${L.pageW} ${L.pageH}" xmlns="http://www.w3.org/2000/svg">` +
        `<path d="${ticks}" fill="none" stroke="#000" stroke-width="0.1"/>` +
        `<text x="${n(L.pageW / 2)}" y="${n(L.pageH - 3.5)}" font-family="Arial, sans-serif" font-size="2.4" fill="#6b7280" text-anchor="middle">${esc(label)}</text>` +
        `</svg></div>`
      );
    })
    .join("");
  return (
    `<!doctype html><html><head><meta charset="utf-8"><style>` +
    `html,body{margin:0;padding:0;background:#fff}` +
    `@page{size:${L.pageW}mm ${L.pageH}mm;margin:0}` +
    `.p{position:relative;width:${L.pageW}mm;height:${L.pageH}mm;overflow:hidden;break-after:page}` +
    `.p:last-child{break-after:auto}` +
    `.c{position:absolute;width:${n(artW)}mm;height:${n(artH)}mm}` +
    `.c svg{display:block;width:100%;height:100%}` +
    `.m{position:absolute;left:0;top:0;width:100%;height:100%}` +
    `</style></head><body>${body}</body></html>`
  );
}