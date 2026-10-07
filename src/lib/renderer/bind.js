// src/lib/renderer/bind.js
// Helpers that connect template + data:
//   escapeXml / bindText / resolveColor / initials / isSafeSrc

// SVG is XML. A name like  D'Souza & Co <Ltd>  would break it, so we replace
// the special characters with safe codes. "&" MUST be replaced first.
export function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// "{{name}} - {{role}}" + { name: "Asha", role: "mentor" } -> "Asha - mentor"
// Returns the text AND the list of fields that were missing/empty.
// The text is NOT escaped here; escape only when writing it into the SVG.
export function bindText(template, data) {
  const missing = [];
  const text = template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, field) => {
    const value = data[field];
    if (value === undefined || value === null || String(value).trim() === '') {
      missing.push(field);
      return '';
    }
    return String(value).trim();
  });
  return { text, missing };
}

const FALLBACK_COLOR = '#64748b'; // grey, used when the role is unknown/missing

// "$role" -> the color for this person's role. Anything else passes through.
export function resolveColor(color, template, data) {
  if (color !== '$role') return color;
  return (data.role && template.roleColors[data.role]) || FALLBACK_COLOR;
}

// "Aarav Shah" -> "AS", "Madonna" -> "M", "" -> ""
export function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = [...parts[0]][0];
  const last = parts.length > 1 ? [...parts[parts.length - 1]][0] : '';
  return (first + last).toUpperCase();
}

// Only allow image sources we expect: base64 data URIs, http(s) URLs, or
// site-relative paths. Anything else (javascript:, file:, ...) is rejected.
export function isSafeSrc(src) {
  return /^(data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,|https?:\/\/|\/)/i.test(src);
}