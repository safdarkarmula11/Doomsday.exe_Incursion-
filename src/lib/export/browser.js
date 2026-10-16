/**
 * Server only. Turns SVG cards into PDF / PNG with a headless Chromium (puppeteer).
 * One browser is started on first use, shared, and closed after a minute idle.
 * Jobs run one at a time so a small server (about 512 MB) is not overloaded.
 */
const IDLE_MS = 60_000;
let browserPromise = null;
let idleTimer = null;
let queue = Promise.resolve();

export class ExportEngineError extends Error {}

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = (async () => {
      const { default: puppeteer } = await import("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions"],
      });
      browser.on("disconnected", () => {
        browserPromise = null;
      });
      return browser;
    })().catch((e) => {
      browserPromise = null;
      console.error("Could not start Chromium:", e);
      throw new ExportEngineError(
        "The export engine (Chromium) could not start. Run `npx puppeteer browsers install chrome` once, then try again."
      );
    });
  }
  return browserPromise;
}

function scheduleClose() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(async () => {
    const p = browserPromise;
    browserPromise = null;
    try {
      (await p)?.close();
    } catch {}
  }, IDLE_MS);
  idleTimer.unref?.();
}

/** Run fn(page) when it is this job's turn. */
function withPage(fn) {
  const job = queue.then(async () => {
    clearTimeout(idleTimer);
    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
      return await fn(page);
    } finally {
      await page.close().catch(() => {});
      scheduleClose();
    }
  });
  queue = job.catch(() => {});
  return job;
}

const BASE_CSS = "html,body{margin:0;padding:0;background:#fff}svg{display:block}";

/** A finished HTML document (with its own @page size) -> PDF. */
export function renderHtmlPdf(html) {
  return withPage(async (page) => {
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, timeout: 120_000 });
    return Buffer.from(pdf);
  });
}

/** @param {string[]} svgs one per card  @returns {Promise<Buffer>} a PDF with one card per page */
export function renderPdf(svgs, widthMm, heightMm) {
  return renderHtmlPdf(
    `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}` +
      `@page{size:${widthMm}mm ${heightMm}mm;margin:0}` +
      `.card{width:${widthMm}mm;height:${heightMm}mm;overflow:hidden;break-after:page}` +
      `.card:last-child{break-after:auto}.card svg{width:100%;height:100%}</style></head><body>` +
      svgs.map((s) => `<div class="card">${s}</div>`).join("") +
      `</body></html>`
  );
}

/** @returns {Promise<Buffer>} a PNG of `widthPx x heightPx` times `scale` */
export function renderPng(svg, widthPx, heightPx, scale = 2) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}svg{width:${widthPx}px;height:${heightPx}px}</style></head><body>${svg}</body></html>`;
  return withPage(async (page) => {
    await page.setViewport({ width: widthPx, height: heightPx, deviceScaleFactor: scale });
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    const png = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: widthPx, height: heightPx } });
    return Buffer.from(png);
  });
}