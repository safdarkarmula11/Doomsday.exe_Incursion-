import { z } from "zod";
import { callModel, extractJson } from "./llm.js";
import { fallbackParse } from "./fallback-parser.js";

/**
 * parseRequest(text) -> {
 *   extracted: { eventName?, tagline?, date?, venue?, roles?, qrBaseUrl? },  only values that are really in the text
 *   missing:   keys the user must still be asked for (drives the questions form)
 *   confirm:   keys we found but are unsure about (show as "please confirm")
 *   dropped:   keys the model returned that are NOT in the user's text (invented, so removed)
 *   source:    "llm" | "fallback"
 * }
 *
 * Flow: LLM -> Zod check -> "is it really in the text?" check -> (retry once) -> rule-based fallback.
 * The model never gets to put anything on a card that the user did not write.
 */

// Order = the order the questions form should ask them in.
export const ASK_ORDER = ["eventName", "tagline", "date", "venue", "roles", "fieldsToShow"];

const CONFIRM_BELOW = 0.75;
const DEFAULT_CONFIDENCE = 0.8; // value was found in the text but the model gave no confidence

const SYSTEM_PROMPT = `You extract event details from a user's request for ID card design.
Reply with ONLY a JSON object, no other text:
{"extracted": {"eventName": string|null, "tagline": string|null, "date": string|null, "venue": string|null, "roles": {"<role>": <count or null>}|null, "qrBaseUrl": string|null}, "confidence": {"<key>": number between 0 and 1}}
Rules:
- Copy values from the request. NEVER invent or guess. If a value is not stated, use null.
- eventName is only an explicit proper name (for example "HackSVNIT 2026"). A description like "our 24-hour hackathon" is NOT a name, so use null.
- date: use yyyy-mm-dd only if the full date including the year is stated, otherwise copy the date text as written (for example "18 October").
- roles: lowercase singular role names with the count if stated, otherwise null.
- tagline: only if the request gives one.`;

/* ---------- Zod schema for the model's reply ---------- */

const ModelReplySchema = z.object({
  extracted: z.object({
    eventName: z.string().nullish(),
    tagline: z.string().nullish(),
    date: z.string().nullish(),
    venue: z.string().nullish(),
    roles: z.record(z.string(), z.number().int().nonnegative().nullable()).nullish(),
    qrBaseUrl: z.string().nullish(),
  }),
  confidence: z.record(z.string(), z.number().min(0).max(1)).default({}),
});

/** Models are sloppy about shape: unwrap, turn "200" into 200, turn 90 into 0.9. */
function normalizeShape(json) {
  if (!json || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Model did not return a JSON object");
  }
  const ex = json.extracted && typeof json.extracted === "object" ? json.extracted : json;

  const toCount = (v) => {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) return Math.round(v);
    if (typeof v === "string" && /^\d[\d,]*$/.test(v.trim())) return parseInt(v.replace(/,/g, ""), 10);
    return null;
  };
  const roles =
    ex.roles && typeof ex.roles === "object" && !Array.isArray(ex.roles)
      ? Object.fromEntries(Object.entries(ex.roles).map(([k, v]) => [k, toCount(v)]))
      : undefined;

  const confidence = {};
  if (json.confidence && typeof json.confidence === "object") {
    for (const [k, v] of Object.entries(json.confidence)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0) continue;
      confidence[k] = Math.min(1, v > 1 && v <= 100 ? v / 100 : v);
    }
  }
  return { extracted: { ...ex, roles }, confidence };
}

/* ---------- "Is it really in the text?" checks (anti-fabrication) ---------- */

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
const appears = (text, value) => norm(text).includes(norm(value));
const clean = (v) => (typeof v === "string" && v.trim() ? v.trim() : null);

const MONTHS = [
  ["january", "jan"], ["february", "feb"], ["march", "mar"], ["april", "apr"],
  ["may"], ["june", "jun"], ["july", "jul"], ["august", "aug"],
  ["september", "sep", "sept"], ["october", "oct"], ["november", "nov"], ["december", "dec"],
];

function dateGrounded(text, value) {
  const iso = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!iso) return appears(text, value);
  const names = MONTHS[Number(iso[2]) - 1];
  if (!names) return false;
  const t = text.toLowerCase();
  const dayOk = new RegExp(`(?<!\\d)0?${Number(iso[3])}(?:st|nd|rd|th)?(?!\\d)`).test(t);
  const monthOk = names.some((n) => new RegExp(`\\b${n}\\b`).test(t));
  return dayOk && monthOk;
}

function countGrounded(text, n) {
  const plain = text.replace(/(\d),(?=\d)/g, "$1"); // 1,50,000 -> 150000
  return new RegExp(`(?<!\\d)${n}(?!\\d)`).test(plain);
}

/** Keep only values that appear in the user's text. Everything else is dropped. */
function ground(text, ex) {
  const kept = {};
  const dropped = [];

  for (const key of ["eventName", "tagline", "venue", "qrBaseUrl"]) {
    const v = clean(ex[key]);
    if (!v) continue;
    if (appears(text, v)) kept[key] = v;
    else dropped.push(key);
  }

  const date = clean(ex.date);
  if (date) {
    if (dateGrounded(text, date)) kept.date = date;
    else dropped.push("date");
  }

  if (ex.roles) {
    const roles = {};
    for (const [name, count] of Object.entries(ex.roles)) {
      const role = name.trim().toLowerCase();
      if (!role) continue;
      if (!appears(text, role)) {
        dropped.push(`roles.${role}`);
        continue;
      }
      roles[role] = count != null && countGrounded(text, count) ? count : null; // unknown count = null
    }
    if (Object.keys(roles).length) kept.roles = roles;
  }
  return { kept, dropped };
}

/* ---------- Missing-fields detector ---------- */

const isBlank = (v) =>
  v == null || (typeof v === "string" && !v.trim()) || (typeof v === "object" && Object.keys(v).length === 0);

/** Which fields must we still ask the user? fieldsToShow is a design choice, so it is always asked. */
export function computeMissing(extracted) {
  return ASK_ORDER.filter((k) => k === "fieldsToShow" || isBlank(extracted[k]));
}

/* ---------- Putting it together ---------- */

function finalize({ extracted, confidence }, text, source, error) {
  const { kept, dropped } = ground(text, extracted);

  const confirm = Object.keys(kept).filter((k) => (confidence[k] ?? DEFAULT_CONFIDENCE) < CONFIRM_BELOW);
  // A model-added year that the user never wrote is an assumption: ask them to confirm.
  if (kept.date && /^\d{4}-/.test(kept.date) && !text.includes(kept.date.slice(0, 4)) && !confirm.includes("date")) {
    confirm.push("date");
  }

  const result = { extracted: kept, missing: computeMissing(kept), confirm, dropped, source };
  if (error) result.error = error.message; // for logs only, do not show to the user
  return result;
}

const cache = new Map(); // same text -> same answer, saves the free-tier rate limit
const CACHE_MAX = 200;

export async function parseRequest(input) {
  const text = String(input ?? "").trim();
  if (!text) return finalize({ extracted: {}, confidence: {} }, "", "fallback");

  if (cache.has(text)) return cache.get(text);

  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reminder = attempt === 1 ? "\n\n(Your previous reply was not valid. Reply with ONLY the JSON object.)" : "";
      const reply = await callModel([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text + reminder },
      ]);
      const parsed = ModelReplySchema.parse(normalizeShape(extractJson(reply)));
      const result = finalize(parsed, text, "llm");

      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
      cache.set(text, result);
      return result;
    } catch (e) {
      lastError = e;
      if (e.code === "NO_TOKEN") break; // retrying will not help
    }
  }

  // LLM unavailable or kept returning bad output: rule-based fallback, never cached.
  return finalize(fallbackParse(text), text, "fallback", lastError);
}