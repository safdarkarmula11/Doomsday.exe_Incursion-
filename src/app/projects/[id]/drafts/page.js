"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Stepper from "@/components/wizard/Stepper";

export default function DraftsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [drafts, setDrafts] = useState(null);
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState("");
  const [error, setError] = useState("");
  const [needsDetails, setNeedsDetails] = useState(false);
  const [busy, setBusy] = useState(""); // "" | "regenerate" | <draftId>
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
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id, load]);

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
      <div className="mx-auto max-w-5xl px-4 py-10">
        <Stepper current={2} />

        <h1 className="text-2xl font-bold">Choose a design</h1>
        <p className="mt-1 text-slate-600">
          Pick the look you like best. You can change colours, text and layout in the next step.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
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
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Preview role">
                <span className="text-sm text-slate-600">Preview as:</span>
                {roles.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => changeRole(r)}
                    aria-pressed={r === role}
                    className={`rounded-full border px-3 py-1 text-sm capitalize ${
                      r === role
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={regenerate}
                disabled={busy !== ""}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {busy === "regenerate" ? "Working..." : "Start over with new designs"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Previews use a sample person (not a real attendee). Your own list of people is added later.
            </p>

            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {drafts.map((d) => (
                <section
                  key={d.id}
                  className={`flex flex-col rounded-xl border bg-white p-4 shadow-sm ${
                    d.selected ? "border-indigo-500 ring-2 ring-indigo-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <h2 className="font-semibold">{d.name}</h2>
                    {d.selected && (
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-medium text-indigo-700">
                        Chosen before
                      </span>
                    )}
                  </div>
                  <div
                    className="mx-auto mt-3 w-full max-w-[220px] overflow-hidden rounded-md shadow-md ring-1 ring-slate-200 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                    role="img"
                    aria-label={`${d.name} design preview`}
                    dangerouslySetInnerHTML={{ __html: d.svg }}
                  />
                  {d.warnings.length > 0 && (
                    <p className="mt-3 text-xs text-amber-700">
                      {d.warnings.length} note{d.warnings.length > 1 ? "s" : ""}: {d.warnings[0].message}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => choose(d.id)}
                    disabled={busy !== ""}
                    className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-400"
                  >
                    {busy === d.id ? "Saving..." : "Choose this design"}
                  </button>
                </section>
              ))}
            </div>

            <Link href={`/projects/${id}/questions`} className="mt-8 inline-block text-sm font-medium text-indigo-600 hover:underline">
              Back to the details
            </Link>
          </>
        )}
      </div>
    </main>
  );
}