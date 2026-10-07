/**
 * Shared by the browser (questions form) and the server (API routes).
 * One definition of "what a valid event looks like", so both sides always agree.
 *
 * eventData shape saved on Project.eventData:
 *   { eventName, tagline, date, venue, roles: { participant: 200, mentor: null }, fieldsToShow: [...], qrBaseUrl,
 *     _meta: { request, confirm, missing, source } }   <- _meta is written once by POST /api/projects
 */
import { z } from "zod";

/** What can appear on a card. name + role are always shown. */
export const FIELD_OPTIONS = [
  { key: "name", label: "Name", locked: true },
  { key: "role", label: "Role", locked: true },
  { key: "photo", label: "Photo" },
  { key: "id", label: "ID number" },
  { key: "organization", label: "College / organization" },
  { key: "qr", label: "QR code (check-in)" },
];
export const DEFAULT_FIELDS = ["name", "role", "photo", "id"];
export const ROLE_PRESETS = ["participant", "organizer", "mentor", "volunteer"];

export const EventDataSchema = z
  .object({
    eventName: z.string().trim().min(1, "Event name is required").max(120, "Keep it under 120 characters"),
    tagline: z.string().trim().max(160, "Keep it under 160 characters").default(""),
    date: z.string().trim().min(1, "Date is required").max(60),
    venue: z.string().trim().min(1, "Venue is required").max(120),
    roles: z
      .record(z.string().min(1).max(40), z.number().int().nonnegative().nullable())
      .refine((r) => Object.keys(r).length > 0, "Add at least one role"),
    fieldsToShow: z.array(z.string()).min(1, "Choose at least one field"),
    qrBaseUrl: z
      .string()
      .trim()
      .default("")
      .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Must start with http:// or https://"),
  })
  .refine((d) => !d.fieldsToShow.includes("qr") || d.qrBaseUrl !== "", {
    message: "Add the attendance link for the QR code (a dummy link is fine for a demo)",
    path: ["qrBaseUrl"],
  });

/** -> { ok: true, data } or { ok: false, errors: { fieldName: "message" } } */
export function validateEventData(input) {
  const result = EventDataSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  const errors = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!errors[key]) errors[key] = issue.message;
  }
  return { ok: false, errors };
}

/** Saved eventData -> values for the form inputs (everything a string, roles as rows). */
export function eventDataToForm(ed = {}) {
  return {
    eventName: ed.eventName ?? "",
    tagline: ed.tagline ?? "",
    date: ed.date ?? "",
    venue: ed.venue ?? "",
    roles: Object.entries(ed.roles ?? {}).map(([name, count]) => ({
      name,
      count: count == null ? "" : String(count),
    })),
    fieldsToShow: Array.isArray(ed.fieldsToShow) && ed.fieldsToShow.length ? ed.fieldsToShow : DEFAULT_FIELDS,
    qrBaseUrl: ed.qrBaseUrl ?? "",
  };
}

/** Form values -> eventData, plus errors the schema can't see (duplicate role, bad count). */
export function formToEventData(form) {
  const errors = {};
  const roles = {};
  for (const row of form.roles) {
    const name = row.name.trim().toLowerCase();
    if (!name) continue; // ignore blank rows
    if (name in roles) {
      errors.roles = `Role "${name}" is listed twice`;
      continue;
    }
    const count = String(row.count ?? "").trim();
    if (count === "") roles[name] = null; // count unknown, fine
    else if (/^\d+$/.test(count)) roles[name] = parseInt(count, 10);
    else errors.roles = `The count for "${name}" must be a whole number`;
  }
  const fieldsToShow = [...new Set([...form.fieldsToShow, "name", "role"])];
  return {
    eventData: {
      eventName: form.eventName,
      tagline: form.tagline,
      date: form.date,
      venue: form.venue,
      roles,
      fieldsToShow,
      qrBaseUrl: form.qrBaseUrl,
    },
    errors,
  };
}