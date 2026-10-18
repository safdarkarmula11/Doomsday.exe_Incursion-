import { AUTH_COOKIE, AUTH_MAX_AGE, authEnabled, makeToken, passcodeMatches, safeNext } from "@/lib/auth";

// Slow down guessing: 8 wrong tries per 10 minutes per address (kept in memory, resets on restart).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS = 8;
const fails = new Map();

function who(request) {
  return (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();
}
function cookie(value, maxAge) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${AUTH_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

/** POST { passcode, next } -> sets the cookie when the passcode is right. */
export async function POST(request) {
  if (!authEnabled()) return Response.json({ ok: true, next: "/" });

  const ip = who(request);
  const now = Date.now();
  const rec = fails.get(ip);
  if (rec && now - rec.first < WINDOW_MS && rec.count >= MAX_FAILS) {
    return Response.json({ error: "Too many wrong tries. Wait a few minutes and try again." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  if (!(await passcodeMatches(body?.passcode))) {
    const fresh = rec && now - rec.first < WINDOW_MS ? rec : { first: now, count: 0 };
    fresh.count += 1;
    fails.set(ip, fresh);
    return Response.json({ error: "That passcode is not right." }, { status: 401 });
  }

  fails.delete(ip);
  return new Response(JSON.stringify({ ok: true, next: safeNext(body?.next) }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie(await makeToken(), AUTH_MAX_AGE) },
  });
}

/** DELETE -> sign out. */
export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie("", 0) },
  });
}