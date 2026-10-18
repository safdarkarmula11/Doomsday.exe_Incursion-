"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

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

/** The saved projects list (needs the browser, so it is the only client part of the home page). */
export default function ProjectsList() {
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
    <section id="projects" className="card scroll-mt-20 p-5 sm:p-6" aria-labelledby="projects-heading">
      <div className="flex items-center justify-between gap-3">
        <h2 id="projects-heading" className="font-display text-2xl font-bold tracking-tight text-slate-900">
          Your projects
        </h2>
        <Link href="/projects/new" className="btn-secondary btn-sm">
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          New project
        </Link>
      </div>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {projects === null ? (
        <p className="mt-4 text-sm text-slate-500">Loading...</p>
      ) : projects.length === 0 && !error ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
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
  );
}