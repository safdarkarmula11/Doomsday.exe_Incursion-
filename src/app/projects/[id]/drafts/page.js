"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Check } from "lucide-react";
import Stepper from "@/components/wizard/Stepper";

export default function DraftsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [drafts, setDrafts] = useState(null);
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [needsDetails, setNeedsDetails] = useState(false);
  const [busy, setBusy] = useState(""); // "" | "regenerate" | "brand" | "add" | <draftId>
  const [brand, setBrand] = useState(null); // { kitId, kits }
  const [allTemplates, setAllTemplates] = useState([]);
  const [addId, setAddId] = useState("");
  const started = useRef(false);

  const load = useCallback(
    async (wantedRole) => {
      const q = wantedRole ? `?role=${encodeURIComponent(wantedRole)}` : "";
      const res = await fetch(`/api/projects/${id}/drafts${q}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNeedsDetails(Boolean(data.needsDetails));
        throw new Error(data.error || "Could not load the designs.");
      }
      return data;
    },
    [id]
  );

  // First visit: if there are no designs yet, create them, then show them.
  useEffect(() => {
    if (started.current) return; // React dev mode runs effects twice; only generate once
    started.current = true;
    (async () => {
      try {
        let data = await load();
        if (data.drafts.length === 0) {
          const res = await fetch(`/api/projects/${id}/drafts`, { method: "POST" });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not create designs.");
          data = await load();
        }
        setDrafts(data.drafts);
        setRoles(data.roles);
        setRole(data.role);
        const [b, t] = await Promise.all([
          fetch(`/api/projects/${id}/brand`).then((r) => r.json()),
          fetch("/api/templates?brief=1").then((r) => r.json()),
        ]);
        if (b.kits) setBrand(b);
        if (t.templates) setAllTemplates(t.templates);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id, load]);

  async function changeKit(kitId) {
    setBusy("brand");
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/brand`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brandKitId: kitId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not change the brand kit.");
      setBrand((b) => ({ ...b, kitId }));
      const data = await load(role);
      setDrafts(data.drafts);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function addDesign() {
    if (!addId) return;
    setBusy("add");
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addTemplateId: addId }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not add the design.");
      const data = await load(role);
      setDrafts(data.drafts);
      setAddId("");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function changeRole(next) {
    setRole(next);
    try {
      const data = await load(next);
      setDrafts(data.drafts);
    } catch (e) {
      setError(e.message);
    }
  }

  async function regenerate() {
    setBusy("regenerate");
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/drafts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerate: true }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not create designs.");
      const data = await load(role);
      setDrafts(data.drafts);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }

  async function choose(draftId) {
    setBusy(draftId);
    setError("");
    try {
      const res = await fetch(`/api/projects/${id}/drafts/${draftId}`, { method: "PATCH" });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save your choice.");
      router.push(`/projects/${id}/editor`);
    } catch (e) {
      setError(e.message);
      setBusy("");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Stepper current={2} />

        <header className="card p-5 sm:p-6">
          <p className="eyebrow">Step 3 of 6</p>
          <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="page-title">Choose a design</h1>
              <p className="page-sub">
                Pick the look you like best. You can change colours, text and layout in the next step.
              </p>
            </div>
            <span className="chip-info font-mono">CR80 · 54 x 85.6 mm</span>
          </div>
        </header>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}{" "}
            {needsDetails && (
              <Link href={`/projects/${id}/questions`} className="font-medium underline">
                Go to the details
              </Link>
            )}
          </div>
        )}

        {!drafts && !error && <p className="mt-8 text-sm text-slate-500">Creating your designs...</p>}

        {drafts && (
          <>
            <div className="card mt-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 p-4">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview role">
                <span className="eyebrow !text-slate-500">Preview as:</span>
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => changeRole(r)}
                    aria-pressed={r === role}
                    className={`rounded-full border px-3 py-1 text-sm font-medium capitalize transition ${
                      r === role
                        ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                        : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button type="button" onClick={regenerate} disabled={busy !== ""} className="btn-secondary">
                {busy === "regenerate" ? "Working..." : "Start over with new designs"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Previews use a sample person (not a real attendee). Your own list of people is added later.
            </p>

            {brand && (
              <div className="card mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 p-4 text-sm">
                <label className="block">
                  <span className="field-label">Brand kit (logos, role colours, fonts)</span>
                  <select
                    value={brand.kitId}
                    onChange={(e) => changeKit(e.target.value)}
                    disabled={busy !== ""}
                    className="field"
                  >
                    {brand.kits.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="field-label">Add a design from a template</span>
                  <span className="flex gap-2">
                    <select
                      value={addId}
                      onChange={(e) => setAddId(e.target.value)}
                      disabled={busy !== ""}
                      className="field"
                    >
                      <option value="">Choose a template...</option>
                      {allTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                          {t.builtIn ? "" : " (yours)"}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={addDesign} disabled={!addId || busy !== ""} className="btn-secondary h-9">
                      {busy === "add" ? "Adding..." : "Add"}
                    </button>
                  </span>
                </label>
                <span className="flex gap-4 pb-2 text-xs">
                  <Link href="/brand-kits" className="font-medium text-indigo-600 hover:underline">
                    Manage brand kits
                  </Link>
                  <Link href="/templates" className="font-medium text-indigo-600 hover:underline">
                    Manage templates
                  </Link>
                </span>
              </div>
            )}

            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d) => (
                <section
                  key={d.id}
                  className={`card flex flex-col p-4 transition hover:shadow-md ${
                    d.selected ? "!border-indigo-500 ring-2 ring-indigo-200" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="section-title">{d.name}</h2>
                    {d.selected && (
                      <span className="chip-info">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        Chosen before
                      </span>
                    )}
                  </div>
                  <div className="mt-3 rounded-lg bg-indigo-50/60 p-4 ring-1 ring-indigo-100">
                    <div
                      className="card-stage mx-auto w-full max-w-[220px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                      role="img"
                      aria-label={`${d.name} design preview`}
                      dangerouslySetInnerHTML={{ __html: d.svg }}
                    />
                  </div>
                  {d.warnings.length > 0 && (
                    <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-700">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {d.warnings.length} note{d.warnings.length > 1 ? "s" : ""}: {d.warnings[0].message}
                      </span>
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(d.id)}
                    disabled={busy !== ""}
                    className="btn-primary mt-auto w-full !py-2.5 disabled:cursor-wait"
                  >
                    {busy === d.id ? "Saving..." : "Choose this design"}
                  </button>
                </section>
              ))}
            </div>

            <p className="mt-6 rounded-xl bg-indigo-50/60 px-4 py-3 text-xs text-slate-600 ring-1 ring-indigo-100">
              <span className="font-mono font-medium text-indigo-700">Print-ready:</span> CR80 size (54 x 85.6 mm) with 3 mm bleed and crop marks on A4 or A3 sheets.
            </p>

            <Link href={`/projects/${id}/questions`} className="btn-ghost mt-6 inline-flex !px-2 text-indigo-600">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to the details
            </Link>
          </>
        )}
      </div>
    </main>
  );
}