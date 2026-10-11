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
      <div className="mx-auto max-w-4xl px-4 py-10">
        <Stepper current={4} />

        <h1 className="text-2xl font-bold">Add your people</h1>
        <p className="mt-1 text-slate-600">One card is made for each person in your list.</p>

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
        {notice && (
          <p role="status" className="mt-4 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
            {notice}
          </p>
        )}

        {!summary && !error && <p className="mt-8 text-sm text-slate-500">Loading...</p>}

        {summary && (!hasPeople || replacing) && (
          <div className="mt-6">
            {replacing && (
              <button type="button" onClick={() => setReplacing(false)} className="mb-3 text-sm font-medium text-indigo-600 underline">
                Cancel and keep the current list
              </button>
            )}
            <CsvImporter projectId={id} roles={roles} existingCount={summary.total} onDone={imported} />
          </div>
        )}

        {hasPeople && !replacing && (
          <div className="mt-6 space-y-6">
            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Who is in the list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-lg font-semibold">
                    {summary.total} {summary.total === 1 ? "person" : "people"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(summary.byRole).map(([r, n]) => (
                      <span key={r} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs capitalize text-slate-700">
                        {r}: {n}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 text-sm">
                  <button type="button" onClick={() => setReplacing(true)} className="font-medium text-indigo-600 underline">
                    Replace with a new CSV
                  </button>
                  <button type="button" onClick={removeAll} className="text-slate-500 underline hover:text-red-600">
                    Remove everyone
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="Card preview">
              <h2 className="font-semibold">How the cards will look</h2>
              <div className="mt-3">
                <PersonPreview projectId={id} people={people} />
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4" aria-label="People">
              <h2 className="font-semibold">The list</h2>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Name</th>
                      <th className="py-1 pr-3">Role</th>
                      <th className="py-1 pr-3">ID</th>
                      <th className="py-1">Photo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {people.map((p) => (
                      <tr key={p.id}>
                        <td className="py-1.5 pr-3">{p.name}</td>
                        <td className="py-1.5 pr-3 capitalize">{p.role}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{p.externalId}</td>
                        <td className="py-1.5 text-xs text-slate-500">{p.photoUrl ? "yes" : "none"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {people.length < summary.total && (
                <button type="button" onClick={more} className="mt-3 text-sm font-medium text-indigo-600 underline">
                  Show more ({summary.total - people.length} left)
                </button>
              )}
            </section>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-6">
          <Link href={`/projects/${id}/editor`} className="text-sm font-medium text-indigo-600 hover:underline">
            Back to the editor
          </Link>
          <Link
            href={`/projects/${id}/export`}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            {hasPeople ? "Continue to export" : "Skip for now"}
          </Link>
        </div>
      </div>
    </main>
  );
}