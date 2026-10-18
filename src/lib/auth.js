/**
 * Optional passcode gate. Set APP_PASSCODE to turn it on; leave it unset for open access (local development).
 * The cookie holds a keyed hash of a fixed message, never the passcode itself. Changing the passcode
 * signs everyone out. Uses Web Crypto so it works in the proxy and in route handlers.
 */
export const AUTH_COOKIE = "studio_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const authEnabled = () => Boolean(process.env.APP_PASSCODE);

async function hmacHex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The value stored in the cookie after a correct passcode. */
export const makeToken = () => hmacHex(process.env.APP_PASSCODE ?? "", "studio-session-v1");

export async function isValidToken(token) {
  if (!authEnabled() || !token) return false;
  return safeEqual(String(token), await makeToken());
}

/** Compares the typed passcode with the real one without leaking where they differ. */
export async function passcodeMatches(input) {
  if (!authEnabled()) return false;
  const [a, b] = await Promise.all([hmacHex("check", String(input ?? "")), hmacHex("check", process.env.APP_PASSCODE)]);
  return safeEqual(a, b);
}

/** Only allow redirects back into this site. */
export function safeNext(value) {
  const v = String(value ?? "");
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/";
}