"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import Stepper from "@/components/wizard/Stepper";

const PART_SIZE = 50; // keep in step with PART_SIZE in src/lib/export/cards.js
const FORMATS = [
  { key: "pdf", label: "PDF", hint: "for printing" },
  { key: "png", label: "PNG", hint: "an image" },
  { key: "svg", label: "SVG", hint: "for design tools" },
];

const btnPrimary = "btn-primary";
const btnLight = "btn-secondary";

function SectionHead({ n, title, tag }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-700" aria-hidden="true">
          {n}
        </span>
        <h2 className="section-title text-lg">{title}</h2>
      </div>
      {tag}
    </div>
  );
}

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
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Stepper current={5} />
        <p className="eyebrow mt-2">Step 6 of 6</p>
        <h1 className="page-title">Export</h1>
        <p className="page-sub max-w-2xl">
          Download your cards. Each card is 54 × 85.6 mm, the standard ID card size, with both logos built in.
        </p>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            {needsDesign && (
              <Link href={`/projects/${id}/drafts`} className="font-medium underline">
                Choose a design
              </Link>
            )}
          </p>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <div className="space-y-6 lg:col-start-1 lg:row-start-1">
            <section className="card-pad" aria-label="Pre-flight check">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-semibold text-indigo-700" aria-hidden="true">
                    1
                  </span>
                  <h2 className="section-title text-lg">Pre-flight check</h2>
                </div>
                <button type="button" onClick={runPre} disabled={preLoading} className="btn-secondary btn-sm">
                  {preLoading ? "Checking..." : "Check again"}
                </button>
              </div>
              {!pre && <p className="mt-3 text-sm text-slate-500">{preLoading ? "Checking your cards..." : "The check could not run."}</p>}
              {pre && !pre.items.some((i) => i.level === "warn") && (
                <p role="status" className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Looks good. {pre.checked > 0 ? `All ${pre.checked} cards passed.` : "The design passed."}</span>
                </p>
              )}
              {pre && pre.items.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {pre.items.map((item) => (
                    <li
                      key={item.title}
                      className={`rounded-lg border px-3 py-2.5 text-sm ${item.level === "warn" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-slate-200 bg-slate-50 text-slate-700"}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={item.level === "warn" ? "chip-warn" : "chip-info"}>
                          {item.level === "warn" ? <AlertTriangle className="h-3 w-3" aria-hidden="true" /> : <Info className="h-3 w-3" aria-hidden="true" />}
                          {item.level === "warn" ? "Warning" : "Note"}
                        </span>
                        <p className="font-medium">{item.title}</p>
                      </div>
                      <p className="mt-1 text-xs">{item.detail}</p>
                      {item.examples && <p className="mono mt-1 text-slate-600">{item.examples.join(", ")}</p>}
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

            <label className="card flex items-start gap-3 p-4 text-sm">
              <input type="checkbox" checked={printReady} onChange={(e) => setPrintReady(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" />
              <span>
                <span className="font-medium">Print-ready PDF and SVG</span>
                <span className="block text-xs text-slate-600">
                  Adds a 3 mm bleed (colour that runs past the cut line) and crop marks, which print shops ask for. Leave it off to print on an office printer. PNG is never changed.
                </span>
              </span>
            </label>

            <section className="card-pad">
              <SectionHead n="2" title="One card" tag={<span className="mono hidden text-slate-500 sm:inline">54 × 85.6 mm</span>} />
              <div className="mt-4 max-w-md">
                <label className="block text-sm">
                  <span className="field-label">Card for</span>
                  <select value={who} onChange={(e) => setWho(e.target.value)} className="field">
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
                    <span className="field-label">Sample role</span>
                    <select value={sampleRole} onChange={(e) => setSampleRole(e.target.value)} className="field">
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
                <label className="mt-3 block text-sm sm:max-w-[240px]">
                  <span className="field-label">PNG quality</span>
                  <select value={dpi} onChange={(e) => setDpi(e.target.value)} className="field">
                    <option value="150">150 dpi (screen)</option>
                    <option value="300">300 dpi (print)</option>
                    <option value="600">600 dpi (very sharp)</option>
                  </select>
                </label>
              </div>
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
              <p className="mt-3 text-xs text-slate-500">PDF: for printing. PNG: an image at the dpi above. SVG: for design tools.</p>
            </section>

            <section className="card-pad">
              <SectionHead
                n="3"
                title="Everyone"
                tag={summary.total > 0 ? <span className="chip-neutral mono">{summary.total} people</span> : null}
              />
              {summary.total === 0 ? (
                <p className="mt-3 text-sm text-slate-600">
                  No people yet.{" "}
                  <Link href={`/projects/${id}/people`} className="font-medium text-indigo-600 underline">
                    Add people from a CSV
                  </Link>{" "}
                  to make a card for each of them.
                </p>
              ) : (
                <>
                  <label className="mt-3 block max-w-xs text-sm">
                    <span className="field-label">Which people</span>
                    <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="field">
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

                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <h3 className="text-sm font-semibold">One card per page</h3>
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
                  </div>
                </>
              )}
            </section>

            {summary.total > 0 && (
              <section className="card-pad">
                <SectionHead n="4" title="Print sheets" tag={<span className="chip-neutral mono">A4 / A3</span>} />
                <p className="mt-2 text-xs text-slate-600">Many cards on each A4 or A3 page, with cut marks in the margin. Print it at 100% size, not fit to page.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm">
                    <span className="field-label">Paper</span>
                    <select value={paper} onChange={(e) => setPaper(e.target.value)} className="field">
                      <option value="a4">A4</option>
                      <option value="a3">A3</option>
                    </select>
                  </label>
                  <label className="block text-sm">
                    <span className="field-label">Page direction</span>
                    <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="field">
                      <option value="auto">Automatic (fits the most cards)</option>
                      <option value="portrait">Portrait</option>
                      <option value="landscape">Landscape</option>
                    </select>
                  </label>
                </div>
                <label className="mt-3 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <input type="checkbox" checked={sheetBleed} onChange={(e) => setSheetBleed(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" />
                  <span>
                    Add a 3 mm bleed
                    <span className="block text-xs text-slate-500">For a print shop. Cards touch and are cut along the marks. Off: cards have a 4 mm gap for cutting by hand.</span>
                  </span>
                </label>
                <label className="mt-2 flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <input type="checkbox" checked={byRole} onChange={(e) => setByRole(e.target.checked)} className="mt-1 h-4 w-4 accent-indigo-600" />
                  <span>
                    Start a new sheet for each role
                    <span className="block text-xs text-slate-500">Handy for printing roles on different paper, or handing out one pile per role.</span>
                  </span>
                </label>
                {sheetInfo ? (
                  <>
                    <p className="mono mt-3 rounded-lg bg-indigo-50 px-3 py-2 text-slate-700">
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
              </section>
            )}

            {busy && (
              <p role="status" className="text-sm text-slate-600">
                Preparing your file. The first one can take around 10 seconds.
              </p>
            )}
            {done && (
              <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {done}
              </p>
            )}
            {fileNotes.length > 0 && (
              <ul className="list-disc pl-5 text-xs text-amber-700">
                {fileNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between text-sm">
              <Link href={`/projects/${id}/people`} className="font-medium text-indigo-600 hover:underline">
                Back to the people
              </Link>
              <Link href={`/projects/${id}/editor`} className="font-medium text-indigo-600 hover:underline">
                Back to the editor
              </Link>
            </div>
          </div>

          <aside className="lg:col-start-2 lg:row-start-1 lg:sticky lg:top-6">
            <div className="card-pad">
              <div className="flex items-center justify-between gap-3">
                <h2 className="section-title">Live preview</h2>
                <span className="chip-neutral mono">{printReady ? "3 mm bleed + marks" : "Trimmed"}</span>
              </div>
              <div className="mt-4 rounded-lg bg-slate-100 p-5">
                <div className="card-stage mx-auto w-full max-w-[240px]" style={{ aspectRatio: printReady ? "660 / 976" : "540 / 856" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {previewUrl && <img src={previewUrl} alt="Preview of the card" className={`block h-full w-full ${previewing ? "opacity-50" : ""}`} />}
                </div>
              </div>
              <dl className="mono mt-3 grid grid-cols-2 gap-2 text-slate-600">
                <div>
                  <dt className="text-[10px] uppercase text-slate-400">Size</dt>
                  <dd>54 × 85.6 mm</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase text-slate-400">Colour</dt>
                  <dd>RGB</dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}