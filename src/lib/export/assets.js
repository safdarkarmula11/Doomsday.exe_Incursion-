/**
 * Server only. Turns an image link into a base64 data URI so the exported file
 * carries its pictures inside it and never depends on a website being online.
 *   "/logos/x.png"      -> read from the public/ folder
 *   "data:image/..."    -> already embedded
 *   "https://..."       -> downloaded (size limit, timeout, no private addresses)
 */
import fs from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";
import net from "node:net";
import { bufferToDataUri } from "@/lib/renderer/assets";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const siteCache = new Map(); // logos never change while the server runs

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:");
}

async function assertPublicHost(hostname) {
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw new Error("private address");
    return;
  }
  const found = await dns.lookup(hostname, { all: true });
  if (found.length === 0 || found.some((f) => isPrivateIp(f.address))) throw new Error("private address");
}

async function download(link) {
  let url = new URL(link);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("not a web link");
    await assertPublicHost(url.hostname);
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location"), url);
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_BYTES) throw new Error("file too big");
    return buf;
  }
  throw new Error("too many redirects");
}

/**
 * @param {string} src
 * @param {Map<string,string|null>} [requestCache] remembers photos already fetched during this export
 * @returns {Promise<{uri: string} | {error: string}>}
 */
export async function toDataUri(src, requestCache = new Map()) {
  const s = String(src ?? "").trim();
  if (!s) return { error: "empty" };
  if (s.startsWith("data:image/")) return { uri: s };
  try {
    if (s.startsWith("/") && !s.startsWith("//")) {
      if (siteCache.has(s)) return { uri: siteCache.get(s) };
      const file = path.resolve(PUBLIC_DIR, "." + s);
      if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new Error("outside public folder");
      const uri = bufferToDataUri(await fs.readFile(file));
      siteCache.set(s, uri);
      return { uri };
    }
    if (requestCache.has(s)) {
      const hit = requestCache.get(s);
      return hit ? { uri: hit } : { error: "failed before" };
    }
    try {
      const uri = bufferToDataUri(await download(s));
      requestCache.set(s, uri);
      return { uri };
    } catch (e) {
      requestCache.set(s, null);
      throw e;
    }
  } catch (e) {
    return { error: e?.message || "failed" };
  }
}