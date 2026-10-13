"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

const btn = "rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";
const btnPrimary = `${btn} bg-indigo-600 text-white hover:bg-indigo-700`;
const btnLight = `${btn} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`;

export default function TemplatesPage() {
  const [templates, setTemplates] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [problems, setProblems] = useState([]);
  const [adding, setAdding] = useState(false);
  const started = useRef(false);

  async function load() {
    const res = await fetch("/api/templates");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Could not load the templates.");
    setTemplates(d.templates);
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load().catch((e) => setError(e.message));
  }, []);

  function download(t) {
    const blob = new Blob([JSON.stringify(t.json, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${t.json.id || "template"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  }

  async function readFile(file) {
    if (!file) return;
    setProblems([]);
    setError("");
    if (file.size > 200_000) return setError("That file is too big for a template.");
    setText(await file.text());
    if (!name) setName(file.name.replace(/\.json$/i, "").replace(/[-_]+/g, " "));
  }

  async function add() {
    setAdding(true);
    setError("");
    setNotice("");
    setProblems([]);
    try {
      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`This is not valid JSON (${e.message}).`);
      }
      const res = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, json }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProblems(d.problems ?? []);
        throw new Error(d.error || "Could not add the template.");
      }
      setNotice(`Added "${d.template.name}". Open any event's Designs page and use "Add a design from a template" to try it.`);
      setName("");
      setText("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAdding(false);
    }
  }

  async function remove(t) {
    if (!window.confirm(`Delete the template "${t.name}"?`)) return;
    setError("");
    setNotice("");
    const res = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Could not delete.");
    setNotice("Deleted.");
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <nav className="flex gap-4 text-sm font-medium text-indigo-600">
          <Link href="/" className="hover:underline">Home</Link>
          <Link href="/brand-kits" className="hover:underline">Brand kits</Link>
          <span className="text-slate-900">Templates</span>
        </nav>
        <h1 className="mt-4 text-2xl font-bold">Templates</h1>
        <p className="mt-1 text-slate-600">
          A template is a card layout. Every event starts from the built-in ones, and you can add your own without changing any code.
        </p>

        {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {!templates && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

        {templates && (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <section key={t.id} className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold">{t.name}</h2>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${t.builtIn ? "bg-slate-100 text-slate-600" : "bg-indigo-100 text-indigo-700"}`}>
                    {t.builtIn ? "Built-in" : "Yours"}
                  </span>
                </div>
                <div
                  className="mx-auto mt-3 w-full max-w-[200px] overflow-hidden rounded-md shadow-md ring-1 ring-slate-200 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                  role="img"
                  aria-label={`${t.name} template preview`}
                  dangerouslySetInnerHTML={{ __html: t.svg }}
                />
                <p className="mt-3 text-xs text-slate-500">
                  {t.json.layers.length} layers · used in {t.usedBy} {t.usedBy === 1 ? "design" : "designs"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => download(t)} className={btnLight}>
                    Download JSON
                  </button>
                  {!t.builtIn && (
                    <button type="button" onClick={() => remove(t)} className={btnLight}>
                      Delete
                    </button>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-8 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold">Add a template</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Download a built-in template above (Download JSON).</li>
            <li>Change it in any text editor: positions, sizes, colours, text, or add and remove layers.</li>
            <li>Upload it here. It is checked first, so a typo shows a clear message.</li>
          </ol>
          <p className="mt-2 text-xs text-slate-500">
            You can also save a design from the editor as a template: open the editor and use &quot;Save as template&quot;.
          </p>
          <label className="mt-4 block max-w-sm text-sm">
            <span className="block text-xs font-medium text-slate-600">Template name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" placeholder="e.g. Workshop badge" />
          </label>
          <label className="mt-3 block text-sm">
            <span className="block text-xs font-medium text-slate-600">Template file (.json)</span>
            <input type="file" accept="application/json,.json" onChange={(e) => readFile(e.target.files?.[0])} className="mt-1 text-xs" />
          </label>
          <label className="mt-3 block text-sm">
            <span className="block text-xs font-medium text-slate-600">or paste the JSON</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-mono text-xs"
              placeholder='{ "canvas": { "width": 540, "height": 856, "background": "#ffffff" }, "roleColors": { ... }, "layers": [ ... ] }'
            />
          </label>
          {problems.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 rounded-lg bg-amber-50 py-2 pl-7 pr-3 text-xs text-amber-900">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
          <button type="button" onClick={add} disabled={adding || !text.trim()} className={`${btnPrimary} mt-4`}>
            {adding ? "Checking..." : "Add template"}
          </button>
        </section>
      </div>
    </main>
  );
}