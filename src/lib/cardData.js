/**
 * Pure helpers shared by the server (previews) and the browser (editor).
 * No database code in here, so it is safe to import from client components.
 */

// Public paths of the two logos (files in public/logos/). Task 11 (export) swaps these for embedded data URIs.
export const LOGO_LEFT = "/logos/ACMLogo.png";
export const LOGO_RIGHT = "/logos/NIT_Surat_Logo.svg.webp";

/** Remove the layers for things the user switched off on the questions page. */
const LAYERS_FOR_FIELD = {
  photo: (id) => id.startsWith("photo"), // photo, photo-frame, photo-ring, photo-gap
  id: (id) => id === "id-number",
};
export function applyFields(template, fieldsToShow = []) {
  const off = Object.entries(LAYERS_FOR_FIELD).filter(([field]) => !fieldsToShow.includes(field));
  return { ...template, layers: template.layers.filter((l) => !off.some(([, matches]) => matches(l.id))) };
}

/** The data one card needs, built from the saved event details plus one person. */
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

/** A made-up person so previews show a full card. Always labelled as a sample in the UI. */
export function samplePerson(role) {
  return { name: "Aarav Sharma", role, idNumber: "SAMPLE-001" };
}