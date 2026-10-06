/**
 * Rule-based extraction. Used when the LLM is down, has no token, or returns bad JSON.
 * It only extracts what is literally written in the text. Everything else stays unknown.
 * Confidence is deliberately low for guessy things (venue) so the user is asked to confirm.
 */

const MONTHS =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

const KNOWN_ROLES = ["participant", "organizer", "mentor", "volunteer", "judge", "speaker", "attendee"];

export function fallbackParse(text) {
  const extracted = {};
  const confidence = {};

  // date: "18 October" or "October 18" (optionally with a year)
  const d1 = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTHS})\\b(?:\\s*,?\\s*(\\d{4}))?`, "i"));
  const d2 = text.match(new RegExp(`\\b(${MONTHS})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(\\d{4}))?`, "i"));
  if (d1) {
    extracted.date = `${d1[1]} ${d1[2]}${d1[3] ? " " + d1[3] : ""}`;
    confidence.date = 0.7;
  } else if (d2) {
    extracted.date = `${d2[2]} ${d2[1]}${d2[3] ? " " + d2[3] : ""}`;
    confidence.date = 0.7;
  }

  // venue: "at SVNIT", "in Seminar Hall"
  const v = text.match(/\b(?:at|in)\s+([A-Z][\w&.\- ]{1,40}?)(?=[,.]|\s+with\b|\s+for\b|\s+on\b|\s+and\b|$)/);
  if (v) {
    extracted.venue = v[1].trim();
    confidence.venue = 0.5;
  }

  // role counts: "200 participants", "20 mentors"
  const roles = {};
  for (const role of KNOWN_ROLES) {
    const m = text.match(new RegExp(`(\\d[\\d,]*)\\s+${role}s?\\b`, "i"));
    if (m) roles[role] = parseInt(m[1].replace(/,/g, ""), 10);
  }
  if (Object.keys(roles).length) {
    extracted.roles = roles;
    confidence.roles = 0.8;
  }

  return { extracted, confidence };
}