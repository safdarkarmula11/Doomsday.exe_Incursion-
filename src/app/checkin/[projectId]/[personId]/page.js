"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, Undo2, List } from "lucide-react";

const ROLE_COLOURS = { participant: "#2563eb", organizer: "#dc2626", mentor: "#7c3aed", volunteer: "#059669" };
const fmt = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

/** What a phone opens when someone scans a card's QR code. Marks the person as arrived. */
export default function ScanPage() {
  const { projectId, personId } = useParams();
  const externalId = decodeURIComponent(personId);
  const [state, setState] = useState({ status: "loading" });
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return; // React runs effects twice in development
    sent.current = true;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/attendance`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ externalId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) setState({ status: "error", message: data.error || "Could not check this person in." });
        else setState({ status: data.already ? "already" : "done", ...data });
      } catch {
        setState({ status: "error", message: "Could not reach the server. Check your connection and scan again." });
      }
    })();
  }, [projectId, externalId]);

  async function undo() {
    await fetch(`/api/projects/${projectId}/attendance?externalId=${encodeURIComponent(externalId)}`, { method: "DELETE" });
    setState({ status: "undone" });
  }

  const colour = ROLE_COLOURS[state.person?.role] ?? "#475569";
  const tone = { done: "emerald", already: "amber", error: "red", undone: "slate", loading: "slate" }[state.status];
  const Icon = { done: CheckCircle2, already: AlertTriangle, error: XCircle, undone: Undo2, loading: Loader2 }[state.status];
  const title = {
    done: "Checked in",
    already: "Already checked in",
    error: "Not found",
    undone: "Check-in removed",
    loading: "Checking...",
  }[state.status];

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-sm px-4 py-10">
        <div className="card p-6 text-center sm:p-8" role="status" aria-live="polite">
          <Icon
            className={`mx-auto h-16 w-16 ${state.status === "loading" ? "animate-spin" : ""} ${
              { emerald: "text-emerald-600", amber: "text-amber-500", red: "text-red-600", slate: "text-slate-400" }[tone]
            }`}
            aria-hidden="true"
          />
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">{title}</h1>

          {state.person && state.status !== "undone" && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <p className="font-display text-xl font-bold text-slate-900">{state.person.name}</p>
              <p className="mt-2">
                <span className="inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white" style={{ background: colour }}>
                  {state.person.role}
                </span>
              </p>
              <p className="mono mt-2 text-sm text-slate-600">ID: {state.person.externalId}</p>
              {state.checkedInAt && (
                <p className="mt-2 text-sm text-slate-600">
                  {state.status === "already" ? "First checked in " : "At "}
                  {fmt(state.checkedInAt)}
                </p>
              )}
            </div>
          )}
          {state.status === "error" && <p className="mt-3 text-sm text-slate-600">{state.message}</p>}
          {state.status === "undone" && <p className="mt-3 text-sm text-slate-600">This person is no longer marked as arrived.</p>}

          <div className="mt-6 flex flex-col gap-2">
            <Link href={`/checkin/${projectId}`} className="btn-primary py-2.5">
              <List className="h-4 w-4" aria-hidden="true" />
              Open the check-in list
            </Link>
            {(state.status === "done" || state.status === "already") && (
              <button type="button" onClick={undo} className="btn-ghost btn-sm text-slate-500">
                <Undo2 className="h-3.5 w-3.5" aria-hidden="true" />
                Undo check-in
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}