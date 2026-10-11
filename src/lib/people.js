/**
 * Everything about turning a CSV into people. Used in the browser (preview of problems)
 * AND on the server (the real check before saving), so both always agree.
 */
import { z } from "zod";

export const MAX_ROWS = 2000;
export const MAX_FILE_BYTES = 2_000_000;
export const SKIP = "__skip__";

/** The columns we understand. `match` guesses which CSV header is which. */
export const FIELD_DEFS = [
  { key: "name", label: "Name", required: true, match: /^(full\s*name|name|student\s*name|participant\s*name|attendee\s*name)$/i },
  { key: "role", label: "Role", required: true, match: /^(role|type|category|designation|position)$/i },
  {
    key: "id",
    label: "ID number",
    match: /^(id|id\s*(no|number|num)|roll\s*(no|number|num)?|enrol+ment(\s*(no|number))?|reg(istration)?(\s*(no|number|id))?|external\s*id|uid|badge\s*(no|id|number))$/i,
  },
  { key: "photo", label: "Photo link", match: /^(photo|photo\s*(url|link)|picture|image|image\s*url|avatar|pic)$/i },
];

/** Guess { name, role, id, photo } -> header (or ""). A header is used for one field only. */
export function autoMap(headers) {
  const used = new Set();
  const mapping = {};
  for (const f of FIELD_DEFS) {
    const hit = headers.find((h) => !used.has(h) && f.match.test(h.trim()));
    mapping[f.key] = hit ?? "";
    if (hit) used.add(hit);
  }
  return mapping;
}

const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** "Participants" / "Organiser" -> "participant" / "organizer", if that is one of the event's roles. */
export function normalizeRole(raw, roles) {
  let s = clean(raw).toLowerCase().replace(/organis/g, "organiz");
  if (!s) return null;
  if (roles.includes(s)) return s;
  if (s.endsWith("s") && roles.includes(s.slice(0, -1))) return s.slice(0, -1);
  return null;
}

const isPhotoLink = (v) => /^(https?:\/\/|\/(?!\/))\S+$/i.test(v);

/**
 * records: [{ header: value }] straight from the CSV.
 * mapping: { name, role, id, photo } -> header name.
 * roleMap: { "unknown role (lowercase)": "existing role" | SKIP }
 */
export function buildRows({ records, mapping, roles, roleMap = {} }) {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  const idCount = new Map();
  if (mapping.id) {
    for (const r of records) {
      const id = clean(r[mapping.id]).toLowerCase();
      if (id) idCount.set(id, (idCount.get(id) ?? 0) + 1);
    }
  }

  const unknownRoles = new Map(); // raw (lowercase) -> how many rows
  const rows = records.map((rec, i) => {
    const issues = [];
    const name = clean(rec[mapping.name]);
    const rawRole = clean(rec[mapping.role]);
    const key = rawRole.toLowerCase();
    let role = normalizeRole(rawRole, roles);
    let skipped = false;

    if (!name) issues.push({ level: "error", message: "Name is empty." });
    if (!rawRole) issues.push({ level: "error", message: "Role is empty." });
    else if (!role) {
      const choice = roleMap[key];
      if (choice === SKIP) skipped = true;
      else if (choice && roles.includes(choice)) role = choice;
      else {
        issues.push({ level: "error", message: `Unknown role "${rawRole}".` });
        unknownRoles.set(key, (unknownRoles.get(key) ?? 0) + 1);
      }
    }
    if (name.length > 120) issues.push({ level: "error", message: "Name is longer than 120 characters." });
    else if (name.length > 40) issues.push({ level: "warning", message: "Long name; it may be shortened on the card." });

    let externalId = "";
    if (mapping.id) {
      externalId = clean(rec[mapping.id]);
      if (!externalId) issues.push({ level: "warning", message: "No ID number." });
      else if (idCount.get(externalId.toLowerCase()) > 1) issues.push({ level: "warning", message: "This ID number is used more than once." });
    }

    let photoUrl = "";
    if (mapping.photo) {
      const p = clean(rec[mapping.photo]);
      if (p && isPhotoLink(p)) photoUrl = p;
      else if (p) issues.push({ level: "warning", message: "Photo link ignored (it must start with http:// or https://). Initials will be shown." });
    }

    const extra = {};
    for (const [h, v] of Object.entries(rec)) {
      if (mapped.has(h) || Object.keys(extra).length >= 20) continue;
      const val = clean(v).slice(0, 200);
      if (val && h.trim()) extra[h.trim().slice(0, 60)] = val;
    }

    const status = skipped ? "skipped" : issues.some((x) => x.level === "error") ? "error" : issues.length ? "warning" : "ok";
    return { line: i + 2, name, role: role ?? "", externalId, photoUrl, extra, issues, status };
  });

  const count = (s) => rows.filter((r) => r.status === s).length;
  return {
    rows,
    unknownRoles: [...unknownRoles].map(([role, n]) => ({ role, count: n })),
    summary: { total: rows.length, ok: count("ok"), warning: count("warning"), error: count("error"), skipped: count("skipped") },
  };
}

// ---- server side ---------------------------------------------------------------
const PersonInput = z.object({
  name: z.string().trim().min(1, "Name is empty").max(120),
  role: z.string().trim().min(1).max(40),
  externalId: z.string().trim().max(60).default(""),
  photoUrl: z
    .string()
    .trim()
    .max(2000)
    .default("")
    .refine((v) => v === "" || isPhotoLink(v), "Photo link must start with http:// or https://"),
  extra: z.record(z.string().max(60), z.string().max(200)).default({}),
});
export const ImportSchema = z.object({
  people: z.array(PersonInput).min(1, "There are no people to import").max(MAX_ROWS, `Up to ${MAX_ROWS} people at a time`),
  replace: z.boolean().default(true),
});

/** The real check before saving. Every role must be one of the event's roles. */
export function validateImport(body, roles) {
  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = typeof issue.path[1] === "number" ? ` (row ${issue.path[1] + 1})` : "";
    return { ok: false, error: `${issue.message}${where}` };
  }
  const people = [];
  for (const [i, p] of parsed.data.people.entries()) {
    const role = normalizeRole(p.role, roles);
    if (!role) return { ok: false, error: `Row ${i + 1}: "${p.role}" is not a role of this event.` };
    people.push({ ...p, role });
  }
  return { ok: true, people, replace: parsed.data.replace };
}