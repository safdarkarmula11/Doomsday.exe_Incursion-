import { NextResponse } from "next/server";
import { AUTH_COOKIE, authEnabled, isValidToken } from "@/lib/auth";

// Open to everyone: the landing page, the unlock page, the health check, and the files the landing page shows.
const PUBLIC_EXACT = new Set(["/", "/unlock", "/api/unlock", "/api/health", "/favicon.ico", "/sample-people.csv", "/sample-people-photos.csv"]);
const PUBLIC_PREFIX = ["/logos/", "/sample-photos/"];

export async function proxy(request) {
  if (!authEnabled()) return NextResponse.next();

  const { pathname, search } = request.nextUrl;
  if (PUBLIC_EXACT.has(pathname) || PUBLIC_PREFIX.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (await isValidToken(request.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Enter the passcode to use this app.", locked: true }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = "/unlock";
  url.search = "";
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};