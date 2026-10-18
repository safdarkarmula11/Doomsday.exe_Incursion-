"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Download, Search, Check, Undo2, ArrowLeft } from "lucide-react";

const ROLE_COLOURS = { participant: "#2563eb", organizer: "#dc2626", mentor: "#7c3aed", volunteer: "#059669" };
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Who has arrived. Staff can also check people in by hand. */
export default function CheckinList() {
  const { projectId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // all | in | out
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/attendance`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not load the list.");
      setData(d);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 15000); // pick up scans from other phones
    return () => clearInterval(t);
  }, [load]);

  async function toggle(p) {
    setBusyId(p.externalId);
    try {
      const url = `/api/projects/${projectId}/attendance`;
      const res = p.checkedInAt
        ? await fetch(`${url}?externalId=${encodeURIComponent(p.externalId)}`, { method: "DELETE" })
        : await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ externalId: p.externalId }) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Could not save.");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyId("");
    }
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.people ?? []).filter((p) => {
      if (filter === "in" && !p.checkedInAt) return false;
      if (filter === "out" && p.checkedInAt) return false;
      return !q || p.name.toLowerCase().includes(q) || p.externalId.toLowerCase().includes(q) || p.role.toLowerCase().includes(q);
    });
  }, [data, query, filter]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Link href={`/projects/${projectId}/export`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to the project
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Check-in</p>
            <h1 className="page-title">{data?.project?.name ?? "Attendance"}</h1>
          </div>
          {data && (
            <a href={`/api/projects/${projectId}/attendance?format=csv`} className="btn-secondary btn-sm">
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Download CSV
            </a>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        {data && (
          <>
            <section className="mt-5 grid gap-3 sm:grid-cols-[auto_1fr]" aria-label="Totals">
              <div className="card p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-slate-500">Arrived</p>
                <p className="font-display text-3xl font-extrabold text-slate-900">
                  {data.checkedIn}
                  <span className="text-lg font-semibold text-slate-400"> / {data.total}</span>
                </p>
              </div>
              <ul className="card flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
                {Object.entries(data.byRole).map(([role, c]) => (
                  <li key={role} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: ROLE_COLOURS[role] ?? "#64748b" }} aria-hidden="true" />
                    <span className="capitalize">{role}</span>
                    <span className="font-mono font-semibold">{c.checkedIn}/{c.total}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="mt-4 text-sm text-slate-600">
              Scan a card&apos;s QR code with any phone camera to check that person in. Or find them below and tap Check in.
            </p>

            <div className="mt-4 flex flex-wrap gap-3">
              <div className="relative min-w-52 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search name, ID or role"
                  aria-label="Search people"
                  className="field pl-9"
                />
              </div>
              <div className="flex gap-1" role="group" aria-label="Filter">
                {[["all", "All"], ["in", "Arrived"], ["out", "Not yet"]].map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setFilter(k)}
                    aria-pressed={filter === k}
                    className={`btn btn-sm ${filter === k ? "bg-indigo-600 text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {data.total === 0 ? (
              <p className="card mt-4 p-6 text-center text-sm text-slate-500">No people yet. Add them on the People step first.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {shown.length === 0 && <li className="p-6 text-center text-sm text-slate-500">No one matches.</li>}
                {shown.map((p) => (
                  <li key={p.externalId || p.name} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: ROLE_COLOURS[p.role] ?? "#64748b" }} aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs capitalize text-slate-500">
                        {p.role}
                        <span className="mono"> · {p.externalId || "no ID"}</span>
                      </p>
                    </div>
                    {p.checkedInAt && <span className="chip-ok">{time(p.checkedInAt)}</span>}
                    {p.externalId && (
                      <button
                        type="button"
                        disabled={busyId === p.externalId}
                        onClick={() => toggle(p)}
                        className={p.checkedInAt ? "btn-ghost btn-sm text-slate-500" : "btn-primary btn-sm"}
                      >
                        {p.checkedInAt ? <Undo2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        {p.checkedInAt ? "Undo" : "Check in"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}