"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FileText, ListChecks, LayoutTemplate, PenTool, IdCard, Plus, Printer, Users } from "lucide-react";

const HOW_IT_WORKS = [
  { title: "Describe", text: "Tell us about your event in plain English.", Icon: FileText },
  { title: "Questions", text: "Fill in only the details that are missing.", Icon: ListChecks },
  { title: "Drafts", text: "Choose a card layout and colours.", Icon: LayoutTemplate },
  { title: "Editor", text: "Fine-tune the design of your card.", Icon: PenTool },
  { title: "People", text: "Add your people from a CSV and assign roles.", Icon: Users },
  { title: "Export", text: "Download cards and A4/A3 print sheets.", Icon: Printer },
];

const STEP_FOR = {
  describe: { label: "Describe", path: () => "/projects/new" },
  questions: { label: "Questions", path: (id) => `/projects/${id}/questions` },
  drafts: { label: "Drafts", path: (id) => `/projects/${id}/drafts` },
  editor: { label: "Editor", path: (id) => `/projects/${id}/editor` },
  people: { label: "People", path: (id) => `/projects/${id}/people` },
  export: { label: "Export", path: (id) => `/projects/${id}/export` },
};

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export default function Home() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not load projects.");
      setProjects(data.projects);
      setError("");
    } catch (e) {
      setError(e.message);
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function remove(p) {
    if (!window.confirm(`Delete "${p.name}" with all its people and drafts? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error || "Could not delete.");
      setProjects((list) => list.filter((x) => x.id !== p.id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <section className="card overflow-hidden p-6 sm:p-10">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_auto]">
            <div>
              <p className="eyebrow inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
                CR80 / 300 DPI print-ready
              </p>
              <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
                ID cards, ready to print
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                Describe your event, pick a design, add your people from a CSV, and export print-ready cards with QR codes
                and role colours.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/projects/new" className="btn-primary px-4 py-2.5">
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Start a new project
                </Link>
                <Link href="/brand-kits" className="btn-secondary px-4 py-2.5">
                  Brand kits
                </Link>
                <Link href="/templates" className="btn-secondary px-4 py-2.5">
                  Templates
                </Link>
              </div>
              <dl className="mt-8 grid max-w-lg grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
                {[
                  ["Card size", "54 x 85.6 mm"],
                  ["Export", "300 DPI PNG"],
                  ["Bleed", "3 mm + crop marks"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-mono text-[10px] uppercase tracking-wider text-slate-500">{k}</dt>
                    <dd className="mt-1 font-mono text-xs font-medium text-slate-900 sm:text-sm">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="mx-auto hidden rounded-2xl bg-indigo-50 p-4 sm:block" aria-hidden="true">
              <div className="card-stage relative flex h-80 w-52 flex-col items-center justify-center border-2 border-dashed border-rose-300">
                <div className="absolute inset-2 rounded border border-slate-200" />
                <div className="absolute top-3 h-1.5 w-10 rounded-full bg-slate-200" />
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
                  <IdCard className="h-7 w-7" />
                </div>
                <div className="mt-3 rounded bg-indigo-600 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white">
                  Role
                </div>
                <div className="mt-2 h-2.5 w-24 rounded bg-slate-300" />
                <div className="mt-1.5 h-2 w-16 rounded bg-slate-200" />
                <div className="mt-4 grid h-12 w-12 grid-cols-3 gap-0.5 rounded bg-white p-1 ring-1 ring-slate-200">
                  {[1, 1, 0, 1, 0, 1, 0, 1, 1].map((on, i) => (
                    <span key={i} className={on ? "bg-slate-800" : "bg-slate-100"} />
                  ))}
                </div>
                <span className="absolute bottom-3 font-mono text-[9px] text-slate-400">Illustration</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="how-heading">
          <p className="eyebrow">Workflow</p>
          <h2 id="how-heading" className="font-display text-2xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {HOW_IT_WORKS.map((h, i) => (
              <li key={h.title} className="card p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-50 font-mono text-xs font-semibold text-indigo-700">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h.Icon className="h-4 w-4 text-slate-400" aria-hidden="true" />
                </div>
                <p className="mt-3 font-display text-sm font-semibold text-slate-900">{h.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-600">{h.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="card mt-12 p-5 sm:p-6" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="font-display text-2xl font-bold tracking-tight text-slate-900">
            Your projects
          </h2>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {projects === null ? (
            <p className="mt-4 text-sm text-slate-500">Loading...</p>
          ) : projects.length === 0 && !error ? (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No projects yet.{" "}
              <Link href="/projects/new" className="font-medium text-indigo-600 hover:underline">
                Create your first one
              </Link>
              .
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white">
              {projects.map((p) => {
                const step = STEP_FOR[p.status] || STEP_FOR.drafts;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <span
                      className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 font-mono text-xs font-semibold text-indigo-700 sm:flex"
                      aria-hidden="true"
                    >
                      {(p.name || "?").trim().slice(0, 2).toUpperCase()}
                    </span>
                    <Link href={step.path(p.id)} className="min-w-0 flex-1">
                      <span className="block truncate font-display font-semibold hover:text-indigo-700">{p.name}</span>
                      <span className="text-xs text-slate-500">Updated {timeAgo(p.updatedAt)}</span>
                    </Link>
                    <span className="chip-info">{step.label}</span>
                    <Link href={step.path(p.id)} className="btn-secondary btn-sm">
                      Open
                    </Link>
                    <button
                      type="button"
                      onClick={() => remove(p)}
                      className="btn-ghost btn-sm text-slate-500 hover:text-red-600"
                      aria-label={`Delete ${p.name}`}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}