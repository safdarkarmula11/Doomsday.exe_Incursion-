"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Stepper from "@/components/wizard/Stepper";

const PART_SIZE = 50; // keep in step with PART_SIZE in src/lib/export/cards.js
const FORMATS = [
  { key: "pdf", label: "PDF", hint: "for printing" },
  { key: "png", label: "PNG", hint: "an image" },
  { key: "svg", label: "SVG", hint: "for design tools" },
];

const btn =
  "rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const btnLight = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;

function readNotes(res) {
  try {
    return JSON.parse(decodeURIComponent(res.headers.get("X-Notes") || "[]"));
  } catch {
    return [];
  }
}

export default function ExportPage() {
  const { id } = useParams();
  const [roles, setRoles] = useState([]);
  const [summary, setSummary] = useState({ total: 0, byRole: {} });
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [needsDesign, setNeedsDesign] = useState(false);

  const [who, setWho] = useState("sample"); // "sample" or a person id
  const [sampleRole, setSampleRole] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewNotes, setPreviewNotes] = useState([]);
  const [previewing, setPreviewing] = useState(false);

  const [printReady, setPrintReady] = useState(false);
  const [pre, setPre] = useState(null); // pre-flight result { checked, items }
  const [preLoading, setPreLoading] = useState(true);

  const [dpi, setDpi] = useState("300");
  const [paper, setPaper] = useState("a4");
  const [orientation, setOrientation] = useState("auto");
  const [sheetBleed, setSheetBleed] = useState(false);
  const [byRole, setByRole] = useState(false);
  const [sheetInfo, setSheetInfo] = useState(null); // { perSheet, sheets, parts, ... }
  const [roleFilter, setRoleFilter] = useState("");
  const [busy, setBusy] = useState("");
  const [done, setDone] = useState("");
  const [fileNotes, setFileNotes] = useState([]);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not load this project.");
        const r = Object.keys(d.project.eventData?.roles ?? {});
        if (r.length === 0) throw new Error("Finish the event details first.");
        setRoles(r);
        setSampleRole(r[0]);
        const p = await fetch(`/api/projects/${id}/people?limit=200`);
        const pd = await p.json().catch(() => ({}));
        if (p.ok) {
          setSummary({ total: pd.total, byRole: pd.byRole });
          setPeople(pd.people);
        }
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id]);

  // The preview is the real exported SVG, so what you see is what you download.
  useEffect(() => {
    if (!sampleRole && who === "sample") return;
    let off = false;
    let url = "";
    (async () => {
      setPreviewing(true);
      try {
        const q = who === "sample" ? `person=sample&role=${encodeURIComponent(sampleRole)}` : `person=${who}`;
        const res = await fetch(`/api/projects/${id}/export?format=svg&${q}${printReady ? "&print=1" : ""}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          if (res.status === 409) setNeedsDesign(true);
          throw new Error(d.error || "Could not make the preview.");
        }
        const text = await res.text();
        url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
        if (off) return URL.revokeObjectURL(url);
        setNeedsDesign(false);
        setError("");
        setPreviewNotes(readNotes(res));
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old);
          return url;
        });
      } catch (e) {
        if (!off) setError(e.message);
      } finally {
        if (!off) setPreviewing(false);
      }
    })();
    return () => {
      off = true;
    };
  }, [id, who, sampleRole, printReady]);

  const loadPre = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/export/preflight`);
      const d = await res.json().catch(() => ({}));
      return res.ok ? d : null;
    } catch {
      return null;
    }
  }, [id]);

  async function runPre() {
    setPreLoading(true);
    setPre(await loadPre());
    setPreLoading(false);
  }

  useEffect(() => {
    if (roles.length === 0) return;
    let off = false;
    loadPre().then((d) => {
      if (off) return;
      setPre(d);
      setPreLoading(false);
    });
    return () => {
      off = true;
    };
  }, [roles, loadPre]);

  const roleQuery = roleFilter ? `&role=${encodeURIComponent(roleFilter)}` : "";
  const sheetQuery = `sheet=1&paper=${paper}&orientation=${orientation}${sheetBleed ? "&bleed=1" : ""}${byRole ? "&byrole=1" : ""}${roleQuery}`;

  useEffect(() => {
    if (summary.total === 0) return;
    let off = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}/export?format=pdf&info=1&${sheetQuery}`);
        const d = await res.json().catch(() => ({}));
        if (!off) setSheetInfo(res.ok ? d : null);
      } catch {
        if (!off) setSheetInfo(null);
      }
    })();
    return () => {
      off = true;
    };
  }, [id, summary.total, sheetQuery]);

  const download = useCallback(
    async (query, label) => {
      setBusy(label);
      setDone("");
      setFileNotes([]);
      setError("");
      try {
        const res = await fetch(`/api/projects/${id}/export?${query}`);
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "The export failed.");
        }
        const blob = await res.blob();
        const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || "cards";
        const a = document.createElement("a");
        const href = URL.createObjectURL(blob);
        a.href = href;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 10_000);
        setDone(`Downloaded ${name}`);
        setFileNotes(readNotes(res));
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy("");
      }
    },
    [id]
  );

  const printQuery = printReady ? "&print=1" : "";
  const personQuery = who === "sample" ? `person=sample&role=${encodeURIComponent(sampleRole)}` : `person=${who}`;
  const count = roleFilter ? summary.byRole[roleFilter] ?? 0 : summary.total;
  const parts = Math.ceil(count / PART_SIZE);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <Stepper current={5} />
        <h1 className="text-2xl font-bold">Export</h1>
        <p className="mt-2 text-slate-600">
          Download your cards. Each card is 54 × 85.6 mm, the standard ID card size, with both logos built in.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            {needsDesign && (
              <Link href={`/projects/${id}/drafts`} className="font-medium underline">
                Choose a design
              </Link>
            )}
          </p>
        )}

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5" aria-label="Pre-flight check">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Pre-flight check</h2>
            <button type="button" onClick={runPre} disabled={preLoading} className={btnLight}>
              {preLoading ? "Checking..." : "Check again"}
            </button>
          </div>
          {!pre && <p className="mt-2 text-sm text-slate-500">{preLoading ? "Checking your cards..." : "The check could not run."}</p>}
          {pre && !pre.items.some((i) => i.level === "warn") && (
            <p role="status" className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Looks good. {pre.checked > 0 ? `All ${pre.checked} cards passed.` : "The design passed."}
            </p>
          )}
          {pre && pre.items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {pre.items.map((item) => (
                <li
                  key={item.title}
                  className={`rounded-lg px-3 py-2 text-sm ${item.level === "warn" ? "bg-amber-50 text-amber-900" : "bg-slate-50 text-slate-700"}`}
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs">{item.detail}</p>
                  {item.examples && <p className="mt-1 text-xs">{item.examples.join(", ")}</p>}
                </li>
              ))}
            </ul>
          )}
          {pre?.items.some((i) => i.level === "warn") && (
            <p className="mt-3 text-xs text-slate-500">
              You can still download.{" "}
              <Link href={`/projects/${id}/editor`} className="font-medium text-indigo-600 underline">
                Fix in the editor
              </Link>{" "}
              and press Check again.
            </p>
          )}
        </section>

        <label className="mt-6 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          <input type="checkbox" checked={printReady} onChange={(e) => setPrintReady(e.target.checked)} className="mt-1 h-4 w-4" />
          <span>
            <span className="font-medium">Print-ready PDF and SVG</span>
            <span className="block text-xs text-slate-600">
              Adds a 3 mm bleed (colour that runs past the cut line) and crop marks, which print shops ask for. Leave it off to print on an office printer. PNG is never changed.
            </span>
          </span>
        </label>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">One card</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-[240px_1fr]">
            <div className="mx-auto w-full max-w-[240px]">
              <div
                className="overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200"
                style={{ aspectRatio: printReady ? "660 / 976" : "540 / 856" }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {previewUrl && <img src={previewUrl} alt="Preview of the card" className={`block h-full w-full ${previewing ? "opacity-50" : ""}`} />}
              </div>
            </div>
            <div>
              <label className="block text-sm">
                <span className="block text-xs font-medium text-slate-600">Card for</span>
                <select
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="sample">A sample card</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.role})
                    </option>
                  ))}
                </select>
              </label>
              {summary.total > people.length && (
                <p className="mt-1 text-xs text-slate-500">Showing the first {people.length} people. Everyone is included in the PDF below.</p>
              )}
              {who === "sample" && (
                <label className="mt-3 block text-sm">
                  <span className="block text-xs font-medium text-slate-600">Sample role</span>
                  <select
                    value={sampleRole}
                    onChange={(e) => setSampleRole(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  >
                    {roles.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {previewNotes.length > 0 && (
                <ul className="mt-3 list-disc pl-5 text-xs text-amber-700">
                  {previewNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {FORMATS.map((f) => (
                  <button
                    key={f.key}
                    type="button"
                    disabled={!!busy || needsDesign}
                    onClick={() => download(`format=${f.key}&${personQuery}${f.key === "png" ? `&dpi=${dpi}` : printQuery}`, f.label)}
                    className={f.key === "pdf" ? btnPrimary : btnLight}
                    title={f.hint}
                  >
                    {busy === f.label ? "Preparing..." : `Download ${f.label}`}
                  </button>
                ))}
              </div>
              <label className="mt-3 block max-w-[220px] text-sm">
                <span className="block text-xs font-medium text-slate-600">PNG quality</span>
                <select value={dpi} onChange={(e) => setDpi(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                  <option value="150">150 dpi (screen)</option>
                  <option value="300">300 dpi (print)</option>
                  <option value="600">600 dpi (very sharp)</option>
                </select>
              </label>
              <p className="mt-2 text-xs text-slate-500">PDF: for printing. PNG: an image at the dpi above. SVG: for design tools.</p>
            </div>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Everyone</h2>
          {summary.total === 0 ? (
            <p className="mt-2 text-sm text-slate-600">
              No people yet.{" "}
              <Link href={`/projects/${id}/people`} className="font-medium text-indigo-600 underline">
                Add people from a CSV
              </Link>{" "}
              to make a card for each of them.
            </p>
          ) : (
            <>
              <label className="mt-3 block max-w-xs text-sm">
                <span className="block text-xs font-medium text-slate-600">Which people</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                >
                  <option value="">Everyone ({summary.total})</option>
                  {roles
                    .filter((r) => summary.byRole[r])
                    .map((r) => (
                      <option key={r} value={r}>
                        Only {r} ({summary.byRole[r]})
                      </option>
                    ))}
                </select>
              </label>

              <h3 className="mt-5 text-sm font-semibold">One card per page</h3>
              <p className="text-xs text-slate-600">One PDF, one card per page, in role and name order. Uses the print-ready option above.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {Array.from({ length: parts }, (_, i) => {
                  const from = i * PART_SIZE + 1;
                  const to = Math.min(count, (i + 1) * PART_SIZE);
                  const label = parts === 1 ? `PDF of ${count} ${count === 1 ? "card" : "cards"}` : `PDF part ${i + 1} (cards ${from}-${to})`;
                  return (
                    <button
                      key={i}
                      type="button"
                      disabled={!!busy || needsDesign}
                      onClick={() => download(`format=pdf&all=1&part=${i + 1}${roleQuery}${printQuery}`, `part${i}`)}
                      className={btnPrimary}
                    >
                      {busy === `part${i}` ? "Preparing..." : `Download ${label}`}
                    </button>
                  );
                })}
              </div>
              {parts > 1 && (
                <p className="mt-2 text-xs text-slate-500">
                  Big lists are split into files of {PART_SIZE} cards so the download stays fast. Each file takes a few seconds to prepare.
                </p>
              )}

              <h3 className="mt-6 text-sm font-semibold">Print sheets</h3>
              <p className="text-xs text-slate-600">Many cards on each A4 or A3 page, with cut marks in the margin. Print it at 100% size, not fit to page.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm">
                  <span className="block text-xs font-medium text-slate-600">Paper</span>
                  <select value={paper} onChange={(e) => setPaper(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    <option value="a4">A4</option>
                    <option value="a3">A3</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="block text-xs font-medium text-slate-600">Page direction</span>
                  <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                    <option value="auto">Automatic (fits the most cards)</option>
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </label>
              </div>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={sheetBleed} onChange={(e) => setSheetBleed(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  Add a 3 mm bleed
                  <span className="block text-xs text-slate-500">For a print shop. Cards touch and are cut along the marks. Off: cards have a 4 mm gap for cutting by hand.</span>
                </span>
              </label>
              <label className="mt-2 flex items-start gap-2 text-sm">
                <input type="checkbox" checked={byRole} onChange={(e) => setByRole(e.target.checked)} className="mt-1 h-4 w-4" />
                <span>
                  Start a new sheet for each role
                  <span className="block text-xs text-slate-500">Handy for printing roles on different paper, or handing out one pile per role.</span>
                </span>
              </label>
              {sheetInfo ? (
                <>
                  <p className="mt-3 text-sm text-slate-700">
                    {sheetInfo.perSheet} cards per sheet ({sheetInfo.cols} × {sheetInfo.rows}, {sheetInfo.orientation}) · {sheetInfo.sheets} {sheetInfo.sheets === 1 ? "sheet" : "sheets"}
                    {sheetInfo.parts > 1 ? ` in ${sheetInfo.parts} files` : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Array.from({ length: sheetInfo.parts }, (_, i) => {
                      const from = i * sheetInfo.pagesPerFile + 1;
                      const to = Math.min(sheetInfo.sheets, (i + 1) * sheetInfo.pagesPerFile);
                      const label = sheetInfo.parts === 1 ? `Download ${sheetInfo.sheets} ${sheetInfo.sheets === 1 ? "sheet" : "sheets"} (PDF)` : `Download sheets ${from}-${to} (PDF)`;
                      return (
                        <button
                          key={i}
                          type="button"
                          disabled={!!busy || needsDesign}
                          onClick={() => download(`format=pdf&${sheetQuery}&part=${i + 1}`, `sheet${i}`)}
                          className={btnPrimary}
                        >
                          {busy === `sheet${i}` ? "Preparing..." : label}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Working out the layout...</p>
              )}
            </>
          )}
        </section>

        {busy && (
          <p role="status" className="mt-4 text-sm text-slate-600">
            Preparing your file. The first one can take around 10 seconds.
          </p>
        )}
        {done && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {done}
          </p>
        )}
        {fileNotes.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
            {fileNotes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        <div className="mt-8 flex items-center justify-between text-sm">
          <Link href={`/projects/${id}/people`} className="font-medium text-indigo-600 hover:underline">
            Back to the people
          </Link>
          <Link href={`/projects/${id}/editor`} className="font-medium text-indigo-600 hover:underline">
            Back to the editor
          </Link>
        </div>
      </div>
    </main>
  );
}