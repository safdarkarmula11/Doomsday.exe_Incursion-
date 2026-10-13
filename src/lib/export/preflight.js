/**
 * Pre-flight check: finds things that would go wrong on paper BEFORE you print.
 * Pure function (no database, no network), so it is fast even for 2000 people.
 *   design  = the template with the editor changes applied (what applyConfig returns)
 *   people  = saved Person rows (can be empty: then only the design is checked)
 * Returns { checked, items: [{ level: "warn" | "info", title, detail, examples? }] }.
 */
import QRCode from "qrcode";
import { renderCard } from "@/lib/renderer/renderCard";
import { cardData, personToCard, qrLink } from "@/lib/cardData";
import { layerLabel } from "@/lib/editorConfig";

const PX_PER_MM = 10;
const PT_PER_PX = 1 / 3.528; // 1 px on the card = 0.1 mm = 0.283 pt
export const MIN_TEXT_PT = 5; // smaller print is hard to read on an ID card
export const SAFE_MM = 3; // keep content this far from the cut line
export const MIN_QR_MODULE_MM = 0.25; // a QR "dot" smaller than this prints badly at 300 dpi

const list = (names, max = 3) => (names.length > max ? [...names.slice(0, max), `and ${names.length - max} more`] : names);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export function runPreflight({ design, eventData, people = [] }) {
  const items = [];
  const { width: W, height: H } = design.canvas;
  const safe = SAFE_MM * PX_PER_MM;

  // ---- the design itself ----
  const small = design.layers
    .filter((l) => (l.type === "text" || l.type === "badge") && l.size * PT_PER_PX < MIN_TEXT_PT)
    .map((l) => `${layerLabel(l.id)} (${(l.size * PT_PER_PX).toFixed(1)} pt)`);
  if (small.length > 0) {
    items.push({
      level: "warn",
      title: "Text is very small",
      detail: `Print under ${MIN_TEXT_PT} pt is hard to read. Make it bigger in the editor.`,
      examples: small,
    });
  }

  const edge = design.layers
    .filter((l) => ["text", "badge", "image", "qr"].includes(l.type))
    .filter((l) => l.x < safe || l.y < safe || l.x + l.w > W - safe || l.y + l.h > H - safe)
    .map((l) => layerLabel(l.id));
  if (edge.length > 0) {
    items.push({
      level: "warn",
      title: `Too close to the edge (under ${SAFE_MM} mm)`,
      detail: "A cutter can be a little off, so these could be trimmed. Move them inwards in the editor.",
      examples: edge,
    });
  }

  // ---- the QR code ----
  const qrLayer = design.layers.find((l) => l.type === "qr");
  const ids = people.map((p) => p.externalId).filter(Boolean);
  if (qrLayer) {
    const longest = ids.reduce((a, b) => (qrLink(eventData.qrBaseUrl, b).length > qrLink(eventData.qrBaseUrl, a).length ? b : a), ids[0] ?? "SAMPLE-001");
    try {
      const n = QRCode.create(qrLink(eventData.qrBaseUrl, longest), { errorCorrectionLevel: "M" }).modules.size;
      const moduleMm = Math.min(qrLayer.w, qrLayer.h) / PX_PER_MM / (n + 4);
      if (moduleMm < MIN_QR_MODULE_MM) {
        items.push({
          level: "warn",
          title: "QR code may not scan",
          detail: "The link is long for the size of the QR code. Shorten the attendance link, or make the QR code bigger in the editor.",
        });
      }
    } catch {
      items.push({ level: "warn", title: "QR code link is too long", detail: "Shorten the attendance link." });
    }
  }

  // ---- the people ----
  if (people.length === 0) {
    items.push({ level: "info", title: "No people added yet", detail: "Only the design was checked. Add people to check their cards too." });
    return { checked: 0, items };
  }

  const roleColors = design.roleColors ?? {};
  const noColour = [...new Set(people.map((p) => p.role))].filter((r) => !roleColors[r]);
  if (noColour.length > 0) {
    const n = people.filter((p) => noColour.includes(p.role)).length;
    items.push({
      level: "warn",
      title: "A role has no colour",
      detail: `${plural(n, "card uses", "cards use")} grey. Pick a colour for it in the editor (Role colours).`,
      examples: noColour,
    });
  }

  const overflowed = [];
  const hasPhoto = design.layers.some((l) => l.id.startsWith("photo") && l.type === "image");
  let noPhoto = 0;
  for (const p of people) {
    const { warnings } = renderCard(design, cardData(eventData, personToCard(p)));
    if (warnings.some((w) => w.kind === "overflow")) overflowed.push(p.name);
    if (hasPhoto && !p.photoUrl) noPhoto++;
  }
  if (overflowed.length > 0) {
    items.push({
      level: "warn",
      title: `Text was shortened on ${plural(overflowed.length, "card", "cards")}`,
      detail: "These names or lines are too long for their box. Make the box bigger or the text smaller in the editor.",
      examples: list(overflowed),
    });
  }

  const showsId = design.layers.some((l) => l.id === "id-number" || l.type === "qr");
  if (showsId) {
    const without = people.filter((p) => !p.externalId).map((p) => p.name);
    if (without.length > 0) {
      items.push({
        level: "warn",
        title: `${plural(without.length, "person has", "people have")} no ID`,
        detail: qrLayer ? "Their cards show no ID and no QR code. Add the IDs to your CSV and import it again." : "Their cards show no ID. Add the IDs to your CSV and import it again.",
        examples: list(without),
      });
    }
    const seen = new Map();
    for (const id of ids) seen.set(id, (seen.get(id) ?? 0) + 1);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    if (dupes.length > 0) {
      items.push({
        level: "warn",
        title: `${plural(dupes.length, "ID is", "IDs are")} used more than once`,
        detail: qrLayer ? "Two people with the same ID get the same QR code, so check-in cannot tell them apart." : "Two people share the same ID.",
        examples: list(dupes),
      });
    }
  }

  if (noPhoto > 0) {
    items.push({
      level: "info",
      title: `${plural(noPhoto, "person has", "people have")} no photo`,
      detail: "Their cards show their initials instead. Photo links are also tested when you download, and any that fail are listed.",
    });
  }

  return { checked: people.length, items };
}