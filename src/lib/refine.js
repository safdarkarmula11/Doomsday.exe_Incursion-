/**
 * "Refine in plain English": turns a sentence like "make the name bigger and the badge green"
 * into editor changes (the same overrides the side panel makes).
 *
 *   1. Ask the LLM for JSON changes.            (src/lib/llm.js)
 *   2. CHECK everything it says: layer exists, property allowed for that layer, value valid.
 *      Text is only accepted if the user actually typed those words (the model may not invent text).
 *   3. If the LLM is down or understood nothing, a small rule-based parser handles simple commands.
 */
import { callModel, extractJson } from "@/lib/llm";
import { EDITABLE, FONT_OPTIONS, LayerOverride, layerLabel } from "@/lib/editorConfig";

const MAX_INSTRUCTION = 300;

export const NAMED_COLORS = {
  red: "#dc2626", green: "#16a34a", blue: "#2563eb", yellow: "#facc15", orange: "#ea580c", purple: "#7c3aed",
  pink: "#ec4899", black: "#111111", white: "#ffffff", gray: "#6b7280", grey: "#6b7280", navy: "#1e3a8a",
  teal: "#0d9488", maroon: "#7f1d1d", gold: "#ca8a04", cyan: "#06b6d4", brown: "#78350f", violet: "#7c3aed",
  "dark blue": "#1e3a8a", "light blue": "#60a5fa", "dark green": "#166534", "light green": "#4ade80",
};

/** "red" / "#FF0000" / "$role" -> "#rrggbb" / "$role", or null if it is not a colour. */
export function toColor(v) {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (s === "$role") return "$role";
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return "#" + [...s.slice(1)].map((c) => c + c).join("");
  return NAMED_COLORS[s] ?? null;
}

const COLOR_WORDS = Object.keys(NAMED_COLORS).sort((a, b) => b.length - a.length); // "dark blue" before "blue"
function findColor(text) {
  const hex = text.match(/#[0-9a-f]{6}\b/i);
  if (hex) return hex[0].toLowerCase();
  for (const w of COLOR_WORDS) if (new RegExp(`\\b${w}\\b`, "i").test(text)) return NAMED_COLORS[w];
  return null;
}

/** Layers as they are right now (template + the user's changes), hidden ones included. */
function currentLayers(baseLayers, config) {
  return baseLayers.map((l) => ({ ...l, ...(config.layers[l.id] ?? {}) }));
}

const PROP_SCHEMAS = LayerOverride.shape; // the per-property rules (size 4..400, hex colours...)

// ---------------------------------------------------------------------------
// STEP 2: check what the model (or the fallback) proposed
// ---------------------------------------------------------------------------
function sanitize(raw, instruction, layers, roles) {
  const out = { layers: {}, roleColors: {} };
  const ignored = [];
  const byId = new Map(layers.map((l) => [l.id, l]));
  const findLayer = (name) => {
    if (typeof name !== "string") return null;
    const key = name.trim().toLowerCase().replace(/[\s_]+/g, "-");
    return byId.get(key) ?? layers.find((l) => layerLabel(l.id).toLowerCase() === name.trim().toLowerCase()) ?? null;
  };
  const said = instruction.toLowerCase();

  for (const ch of Array.isArray(raw?.changes) ? raw.changes : []) {
    const layer = findLayer(ch?.layer);
    if (!layer) {
      ignored.push(`There is no element called "${ch?.layer}".`);
      continue;
    }
    const allowed = EDITABLE[layer.type] ?? [];
    for (const [prop, rawValue] of Object.entries(ch?.set ?? {})) {
      const label = `${layerLabel(layer.id)}: ${prop}`;
      if (prop !== "hidden" && !allowed.includes(prop)) {
        ignored.push(`${label} cannot be changed.`);
        continue;
      }
      let value = rawValue;
      if (prop === "color" || prop === "fill") value = toColor(rawValue);
      else if (["x", "y", "w", "h", "size", "weight"].includes(prop)) value = typeof rawValue === "string" ? Number(rawValue) : rawValue;
      else if (prop === "font") {
        const f = FONT_OPTIONS.find((o) => o.value === rawValue || o.label.toLowerCase() === String(rawValue).toLowerCase());
        value = f?.value;
      } else if (prop === "text") {
        // anti-fabrication: new text must come from the user's own words (placeholders like {{name}} are fine)
        const bare = String(rawValue).replace(/\{\{\s*\w+\s*\}\}/g, "").trim().toLowerCase();
        if (bare && !said.includes(bare)) {
          ignored.push(`${label}: I only use text you type yourself, so "${rawValue}" was skipped.`);
          continue;
        }
      }
      if (["x", "y", "w", "h", "size", "weight"].includes(prop) && typeof value === "number") {
        value = Math.round(value * 10) / 10;
        if (prop === "weight") value = Math.round(value / 100) * 100;
      }
      const ok = value !== null && value !== undefined && PROP_SCHEMAS[prop]?.safeParse(value).success;
      if (!ok) {
        ignored.push(`${label}: "${rawValue}" is not a valid value.`);
        continue;
      }
      (out.layers[layer.id] ??= {})[prop] = value;
    }
  }

  for (const [role, c] of Object.entries(raw?.roleColors ?? {})) {
    const key = String(role).toLowerCase();
    const color = toColor(c);
    if (!roles.includes(key)) ignored.push(`This event has no role called "${role}".`);
    else if (!color || color === "$role") ignored.push(`"${c}" is not a colour I can use for ${key}.`);
    else out.roleColors[key] = color;
  }
  return { changes: out, ignored };
}

/** Lay the checked changes over the current config. Returns the new config + a readable list. */
function merge(config, changes, layers) {
  const next = { layers: { ...config.layers }, roleColors: { ...config.roleColors } };
  const applied = [];
  const unchanged = [];
  for (const [id, set] of Object.entries(changes.layers)) {
    const before = layers.find((l) => l.id === id);
    const real = {};
    for (const [k, v] of Object.entries(set)) {
      if (before && before[k] === v) {
        unchanged.push(describeChange(id, k, v)); // already like that
        continue;
      }
      real[k] = v;
      applied.push(describeChange(id, k, v));
    }
    if (Object.keys(real).length) next.layers[id] = { ...next.layers[id], ...real };
  }
  for (const [role, c] of Object.entries(changes.roleColors)) {
    if (config.roleColors[role] === c) {
      unchanged.push(`${role[0].toUpperCase() + role.slice(1)} colour: ${c}`);
      continue;
    }
    next.roleColors[role] = c;
    applied.push(`${role[0].toUpperCase() + role.slice(1)} colour: ${c}`);
  }
  return { config: next, applied, unchanged };
}

function describeChange(id, prop, v) {
  const name = layerLabel(id);
  if (prop === "hidden") return v ? `Hid ${name}` : `Showed ${name}`;
  const label = { x: "left", y: "top", w: "width", h: "height", size: "size", weight: "weight", align: "alignment", color: "text colour", fill: "fill colour", text: "text", font: "font" }[prop] ?? prop;
  return `${name}: ${label} → ${v}`;
}

// ---------------------------------------------------------------------------
// STEP 1: the model
// ---------------------------------------------------------------------------
function buildMessages(instruction, layers, roles, selectedId, canvas) {
  const lines = layers.map((l) => {
    const bits = [`x=${l.x}`, `y=${l.y}`, `w=${l.w}`, `h=${l.h}`];
    if (l.size !== undefined) bits.push(`size=${l.size}`);
    if (l.weight !== undefined) bits.push(`weight=${l.weight}`);
    if (l.color !== undefined) bits.push(`color=${l.color}`);
    if (l.fill !== undefined) bits.push(`fill=${l.fill}`);
    if (l.align !== undefined) bits.push(`align=${l.align}`);
    if (l.hidden) bits.push("HIDDEN");
    return `- ${l.id} (${l.type}; ${layerLabel(l.id)}): ${bits.join(", ")}`;
  });
  const system = `You edit the design of an ID card. Reply with ONE JSON object and nothing else.
The card is ${canvas.width} wide and ${canvas.height} tall (units). Elements:
${lines.join("\n")}

Allowed properties: ${Object.entries(EDITABLE).map(([t, p]) => `${t}: ${p.join(", ")}`).join(" | ")}; any element can also take hidden (true/false).
Colours are "#rrggbb" or "$role" (= the colour of each person's role). align is left, center or right. weight is 400, 600 or 700. Fonts: ${FONT_OPTIONS.map((f) => f.label).join(", ")}.
Roles in this event: ${roles.join(", ")}.${selectedId ? `\nThe user has selected: ${selectedId}. If they say "it" or "this", they mean that element.` : ""}

Format: {"changes":[{"layer":"<element id>","set":{"<property>":<value>}}],"roleColors":{"<role>":"#rrggbb"}}
Rules:
- For "bigger"/"smaller" compute a new absolute number from the current one (about 25% change).
- To move an element, give new absolute x and/or y.
- NEVER invent text. Only use "text" if the user typed the exact new words.
- If the request cannot be done with these properties, return {"changes":[],"roleColors":{}}.

Example request: "make the name bigger and the badge green"
Example reply: {"changes":[{"layer":"name","set":{"size":48}},{"layer":"role-badge","set":{"fill":"#16a34a"}}],"roleColors":{}}
Example request: "make mentors purple"
Example reply: {"changes":[],"roleColors":{"mentor":"#7c3aed"}}`;
  return [
    { role: "system", content: system },
    { role: "user", content: instruction },
  ];
}

// ---------------------------------------------------------------------------
// FALLBACK: simple commands without the model
// ---------------------------------------------------------------------------
const KEYWORDS = [
  [/event name|\btitle\b|heading/, ["event-name"]],
  [/subtitle|tagline|slogan/, ["event-subtitle"]],
  [/\bname\b/, ["name"]],
  [/badge|role (label|tag)/, ["role-badge"]],
  [/logos\b|both logos/, ["logo-left", "logo-right"]],
  [/left logo|acm/, ["logo-left"]],
  [/right logo|svnit|nit surat/, ["logo-right"]],
  [/photo|picture|portrait/, ["photo"]],
  [/\bid\b|id number/, ["id-number"]],
  [/\bdate\b/, ["event-date"]],
  [/venue|location/, ["venue"]],
  [/footer|bottom (band|bar|strip)/, ["footer-band", "bottom-band"]],
  [/top (strip|bar|band)/, ["top-strip"]],
];

function fallbackParse(instruction, layers, roles, selectedId) {
  const raw = { changes: [], roleColors: {} };
  const clauses = instruction.toLowerCase().split(/,|;|\band\b|\bthen\b|\balso\b/).map((c) => c.trim()).filter(Boolean);
  let lastTargets = selectedId ? [selectedId] : [];

  for (const clause of clauses) {
    const color = findColor(clause);

    // a role name + a colour = change that role's colour on every card
    const role = roles.find((r) => new RegExp(`\\b${r}s?\\b`).test(clause));
    if (role && color && /colou?r|make|paint|turn|set|change|should be/.test(clause) && !/\btext\b/.test(clause)) {
      raw.roleColors[role] = color;
      continue;
    }

    // which elements?
    let targets = [];
    const labelHit = [...layers].sort((a, b) => b.id.length - a.id.length).find((l) => clause.includes(layerLabel(l.id).toLowerCase()));
    if (labelHit) targets = [labelHit.id];
    else for (const [re, ids] of KEYWORDS) if (re.test(clause)) { targets = ids.filter((id) => layers.some((l) => l.id === id)); if (targets.length) break; }
    if (!targets.length && /\b(it|this|that)\b/.test(clause)) targets = lastTargets;
    if (!targets.length) continue;
    lastTargets = targets;

    for (const id of targets) {
      const l = layers.find((x) => x.id === id);
      const set = {};
      const textual = l.type === "text" || l.type === "badge";

      if (/\b(hide|remove|delete)\b/.test(clause)) set.hidden = true;
      else if (/\b(show|unhide|restore|bring back)\b/.test(clause)) set.hidden = false;

      const grow = /\b(bigger|larger|increase|grow|enlarge)\b/.test(clause);
      const shrink = /\b(smaller|decrease|reduce|shrink)\b/.test(clause);
      if (grow || shrink) {
        const f = grow ? 1.25 : 0.8;
        if (textual && l.size) set.size = Math.round(l.size * f);
        else if (l.type !== "text") { set.w = Math.round(l.w * f); set.h = Math.round(l.h * f); }
      }
      const sized = clause.match(/\bsize\s*(?:to|of|=)?\s*(\d+)/);
      if (sized && textual) set.size = Number(sized[1]);

      if (textual && /\bbold\b/.test(clause) && !/not bold|unbold/.test(clause)) set.weight = 700;
      if (textual && /\b(regular|normal weight|not bold|unbold)\b/.test(clause)) set.weight = 400;

      const al = clause.match(/(?:align(?:ed)?\s*(?:to\s*)?(left|right|cent(?:er|re))|\b(left|right|cent(?:er|re))\s*align|\bcent(?:er|re)d?\b)/);
      if (textual && l.type === "text" && al) set.align = /cent/.test(al[0]) ? "center" : /left/.test(al[0]) ? "left" : "right";

      const mv = clause.match(/\bmove\b.*?\b(up|down|left|right)\b(?:\s*(?:by)?\s*(\d+))?/);
      if (mv) {
        const n = mv[2] ? Number(mv[2]) : 20;
        if (mv[1] === "up") set.y = l.y - n;
        if (mv[1] === "down") set.y = l.y + n;
        if (mv[1] === "left") set.x = l.x - n;
        if (mv[1] === "right") set.x = l.x + n;
      }

      const useRole = /role colou?r/.test(clause);
      if (color || useRole) {
        const c = useRole ? "$role" : color;
        const wantsText = /\btext\b|\bfont colou?r|\bletters\b/.test(clause);
        if (l.type === "rect") set.fill = c;
        else if (l.type === "badge") set[wantsText ? "color" : "fill"] = c;
        else if (l.type === "text") set.color = c;
      }

      const font = FONT_OPTIONS.find((f) => new RegExp(`\\b${f.label.toLowerCase().split(" ")[0]}\\b`).test(clause));
      if (font && l.type === "text") set.font = font.value;

      if (Object.keys(set).length) raw.changes.push({ layer: id, set });
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// the entry point
// ---------------------------------------------------------------------------
/**
 * @returns {{ config, applied: string[], unchanged: string[], ignored: string[], source: "llm"|"fallback" }}
 */
export async function refine({ instruction, template, config, roles, selectedId }) {
  const text = String(instruction ?? "").trim().slice(0, MAX_INSTRUCTION);
  const layers = currentLayers(template.layers, config);
  const knownSelected = layers.some((l) => l.id === selectedId) ? selectedId : null;

  let source = "llm";
  let result = null;
  try {
    const reply = await callModel(buildMessages(text, layers, roles, knownSelected, template.canvas));
    const checked = sanitize(extractJson(reply), text, layers, roles);
    result = { ...merge(config, checked.changes, layers), ignored: checked.ignored };
  } catch (e) {
    console.warn("refine: model unavailable, using simple rules:", e.message);
    result = null;
  }

  if (!result || result.applied.length === 0) {
    const checked = sanitize(fallbackParse(text, layers, roles, knownSelected), text, layers, roles);
    const fb = { ...merge(config, checked.changes, layers), ignored: checked.ignored };
    if (fb.applied.length > 0 || !result) {
      result = fb;
      source = "fallback";
    }
  }
  return { config: result.config, applied: result.applied, unchanged: result.unchanged, ignored: result.ignored, source };
}