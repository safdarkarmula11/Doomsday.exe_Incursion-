"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Stepper from "@/components/wizard/Stepper";
import CsvImporter from "@/components/people/CsvImporter";
import PersonPreview from "@/components/people/PersonPreview";

const PAGE = 50;

export default function PeoplePage() {
  const { id } = useParams();
  const [roles, setRoles] = useState([]);
  const [summary, setSummary] = useState(null); // { total, byRole }
  const [people, setPeople] = useState([]);
  const [error, setError] = useState("");
  const [needsDetails, setNeedsDetails] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const [notice, setNotice] = useState("");
  const started = useRef(false);

  const loadPeople = useCallback(
    async (offset = 0) => {
      const res = await fetch(`/api/projects/${id}/people?offset=${offset}&limit=${PAGE}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load the people.");
      return data;
    },
    [id]
  );

  const refresh = useCallback(async () => {
    const data = await loadPeople(0);
    setSummary({ total: data.total, byRole: data.byRole });
    setPeople(data.people);
  }, [loadPeople]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`);
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "Could not load this project.");
        const r = Object.keys(d.project.eventData?.roles ?? {});
        if (r.length === 0) {
          setNeedsDetails(true);
          throw new Error("Finish the event details first.");
        }
        setRoles(r);
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id, refresh]);

  async function more() {
    try {
      const data = await loadPeople(people.length);
      setPeople((p) => [...p, ...data.people]);
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeAll() {
    if (!window.confirm("Remove everyone from this project?")) return;
    const res = await fetch(`/api/projects/${id}/people`, { method: "DELETE" });
    if (!res.ok) return setError("Could not remove the people.");
    setNotice("");
    await refresh();
  }

  async function imported(count) {
    setReplacing(false);
    setNotice(`Added ${count} ${count === 1 ? "person" : "people"}.`);
    try {
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  }

  const hasPeople = summary && summary.total > 0;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <Stepper current={4} />

        <p className="eyebrow mt-2">Step 5 of 6</p>
        <h1 className="page-title mt-1">Add your people</h1>
        <p className="page-sub">One card is made for each person in your list.</p>

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
        {notice && (
          <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </p>
        )}

        {!summary && !error && <p className="mt-8 text-sm text-slate-500">Loading...</p>}

        {summary && (!hasPeople || replacing) && (
          <div className="mt-6">
            {replacing && (
              <button type="button" onClick={() => setReplacing(false)} className="btn-ghost btn-sm mb-3 text-indigo-700">
                Cancel and keep the current list
              </button>
            )}
            <CsvImporter projectId={id} roles={roles} existingCount={summary.total} onDone={imported} />
          </div>
        )}

        {hasPeople && !replacing && (
          <div className="mt-6 space-y-6">
            <section className="card-pad" aria-label="Who is in the list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-display text-lg font-semibold">
                    <span className="font-mono">{summary.total}</span> {summary.total === 1 ? "person" : "people"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(summary.byRole).map(([r, n]) => (
                      <span key={r} className="chip-info capitalize">
                        {r}: {n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setReplacing(true)} className="btn-secondary btn-sm">
                    Replace with a new CSV
                  </button>
                  <button type="button" onClick={removeAll} className="btn-danger btn-sm">
                    Remove everyone
                  </button>
                </div>
              </div>
            </section>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
              <section className="card order-2 overflow-hidden lg:order-1" aria-label="People">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <h2 className="section-title">The list</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="bg-slate-50 font-mono text-[11px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2 font-medium">Name</th>
                        <th className="px-3 py-2 font-medium">Role</th>
                        <th className="px-3 py-2 font-medium">ID</th>
                        <th className="px-4 py-2 font-medium">Photo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {people.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-900">{p.name}</td>
                          <td className="px-3 py-2 capitalize">
                            <span className="chip-info">{p.role}</span>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{p.externalId}</td>
                          <td className="px-4 py-2 text-xs text-slate-500">{p.photoUrl ? "yes" : "none"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {people.length < summary.total && (
                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                    <button type="button" onClick={more} className="btn-secondary btn-sm">
                      Show more ({summary.total - people.length} left)
                    </button>
                  </div>
                )}
              </section>

              <section className="card-pad order-1 lg:sticky lg:top-20 lg:order-2" aria-label="Card preview">
                <h2 className="section-title">How the cards will look</h2>
                <div className="mt-3 rounded-lg bg-slate-100 p-3">
                  <PersonPreview projectId={id} people={people} />
                </div>
              </section>
            </div>
          </div>
        )}

        <div className="card mt-8 flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <Link href={`/projects/${id}/editor`} className="btn-secondary">
            Back to the editor
          </Link>
          <Link href={`/projects/${id}/export`} className="btn-primary px-5 py-2.5">
            {hasPeople ? "Continue to export" : "Skip for now"}
          </Link>
        </div>
      </div>
    </main>
  );
}