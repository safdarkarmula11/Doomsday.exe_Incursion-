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
  qr: (id) => id === "qr",
};
export function applyFields(template, fieldsToShow = []) {
  const off = Object.entries(LAYERS_FOR_FIELD).filter(([field]) => !fieldsToShow.includes(field));
  return { ...template, layers: template.layers.filter((l) => !off.some(([, matches]) => matches(l.id))) };
}

/** The link inside one person's QR code: the attendance link plus their ID. Empty when either is missing. */
export function qrLink(base, id) {
  const b = String(base ?? "").trim();
  const i = String(id ?? "").trim();
  if (!b || !i) return "";
  if (/[\/=?&]$/.test(b)) return b + encodeURIComponent(i);
  return b.includes("?") ? `${b}&id=${encodeURIComponent(i)}` : `${b}/${encodeURIComponent(i)}`;
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
    qrUrl: qrLink(eventData.qrBaseUrl, person.idNumber),
    ...person,
  };
}

/** A made-up person so previews show a full card. Always labelled as a sample in the UI. */
export function samplePerson(role) {
  return { name: "Aarav Sharma", role, idNumber: "SAMPLE-001" };
}

/** A saved Person row (or imported row) -> the data one card needs. Extra CSV columns are kept for future templates. */
export function personToCard(p) {
  return {
    ...(p.extra ?? {}),
    name: p.name,
    role: p.role,
    idNumber: p.externalId ?? "",
    photo: p.photoUrl ?? "",
  };
}