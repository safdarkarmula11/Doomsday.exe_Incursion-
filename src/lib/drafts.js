/**
 * Server-side helpers for the drafts step.
 * Uses the team's renderer (src/lib/renderer) and templates (src/lib/templates).
 */
import { db } from "@/lib/db";
import { renderCard } from "@/lib/renderer/renderCard";
import { templates } from "@/lib/templates";

// Public paths of the two logos (files in public/logos/). Previews load them straight from the site.
// Task 11 (export) will swap these for embedded data URIs.
const LOGO_LEFT = "/logos/ACMLogo.png";
const LOGO_RIGHT = "/logos/NIT_Surat_Logo.svg.webp";

/** Make sure every template in src/lib/templates exists as a Template row. Returns { slug: row }. */
export async function ensureTemplates() {
  const rows = {};
  for (const json of templates) {
    rows[json.id] = await db.template.upsert({
      where: { slug: json.id },
      update: { name: json.name, designType: "id_card", json },
      create: { slug: json.id, name: json.name, designType: "id_card", json, isDefault: true },
    });
  }
  return rows;
}

/** Remove the layers for things the user switched off on the questions page. */
const LAYERS_FOR_FIELD = {
  photo: (id) => id.startsWith("photo"), // photo, photo-frame, photo-ring, photo-gap
  id: (id) => id === "id-number",
};
export function applyFields(template, fieldsToShow = []) {
  const off = Object.entries(LAYERS_FOR_FIELD).filter(([field]) => !fieldsToShow.includes(field));
  return { ...template, layers: template.layers.filter((l) => !off.some(([, matches]) => matches(l.id))) };
}

/** The data one card needs, built from the saved event details plus one (sample) person. */
export function cardData(eventData, person) {
  return {
    eventName: eventData.eventName,
    eventSubtitle: eventData.tagline,
    eventDate: eventData.date,
    venue: eventData.venue,
    logoLeft: LOGO_LEFT,
    logoRight: LOGO_RIGHT,
    ...person,
  };
}

/** A made-up person so the previews show a full card. Clearly labelled as a sample in the UI. */
export function samplePerson(role) {
  return { name: "Aarav Sharma", role, idNumber: "SAMPLE-001" };
}

/** Render one draft for one role. Draft config (editor changes) is applied on top of the template later. */
export function renderDraft(draft, template, eventData, role) {
  const t = applyFields(template.json, eventData.fieldsToShow ?? []);
  const { svg, warnings } = renderCard(t, cardData(eventData, samplePerson(role)));
  // Several cards share one page, so clip-path ids must be unique per card.
  const prefix = `d${draft.id.slice(-6)}_`;
  const unique = svg.replace(/id="clip-/g, `id="${prefix}clip-`).replace(/url\(#clip-/g, `url(#${prefix}clip-`);
  return { svg: unique, warnings };
}