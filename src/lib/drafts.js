/**
 * Server-side helpers for the drafts step.
 * Uses the team's renderer (src/lib/renderer) and templates (src/lib/templates).
 */
import { db } from "@/lib/db";
import { renderCard } from "@/lib/renderer/renderCard";
import { templates } from "@/lib/templates";
import { applyFields, cardData, samplePerson } from "@/lib/cardData";
import { applyConfig } from "@/lib/editorConfig";

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

/** Render one draft (with the user's editor changes) for one sample role. */
export function renderDraft(draft, template, eventData, role) {
  const t = applyConfig(applyFields(template.json, eventData.fieldsToShow ?? []), draft.config);
  const { svg, warnings } = renderCard(t, cardData(eventData, samplePerson(role)));
  // Several cards share one page, so clip-path ids must be unique per card.
  const prefix = `d${draft.id.slice(-6)}_`;
  const unique = svg.replace(/id="clip-/g, `id="${prefix}clip-`).replace(/url\(#clip-/g, `url(#${prefix}clip-`);
  return { svg: unique, warnings };
}