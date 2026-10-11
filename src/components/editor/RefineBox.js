"use client";

import { useState } from "react";

const EXAMPLES = ["Make the name bigger", "Make organizers red", "Hide the ID number", "Center the event name"];

/** Type a change in plain English. onApply(newConfig) is called once, so it is ONE undo step. */
export default function RefineBox({ projectId, draftId, config, selectedId, onApply }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, applied, ignored, source } | { error }

  async function run(instruction) {
    if (busy || instruction.trim().length < 3) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/drafts/${draftId}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, config, selectedId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (data.applied.length > 0) {
        onApply(data.config);
        setText("");
      }
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Describe a change" className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-semibold">Describe a change</h3>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(text);
        }}
        className="mt-2 flex gap-2"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={300}
          disabled={busy}
          placeholder="e.g. make the name bigger and the badge green"
          aria-label="Describe a change"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length < 3}
          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
        >
          {busy ? "Working..." : "Apply"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={busy}
            onClick={() => run(ex)}
            className="rounded-full border border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
      {selectedId && <p className="mt-2 text-xs text-slate-500">Say "it" or "this" to mean the selected element.</p>}

      <div role="status" aria-live="polite" className="mt-3 text-sm">
        {result?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700">{result.error}</p>}
        {result && !result.error && result.applied.length > 0 && (
          <div className="rounded-lg bg-green-50 px-3 py-2 text-green-800">
            <p className="font-medium">Done. Use Undo if you do not like it.</p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {result.applied.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}
        {result && !result.error && result.applied.length === 0 && result.unchanged.length > 0 && (
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
            It is already like that: {result.unchanged.join("; ")}.
          </p>
        )}
        {result && !result.error && result.applied.length === 0 && result.unchanged.length === 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
            I could not turn that into a change. Try naming the element and what to do, like "make the event name bold".
          </p>
        )}
        {result && !result.error && result.ignored.length > 0 && (
          <ul className="mt-2 list-disc pl-5 text-xs text-amber-700">
            {result.ignored.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {result?.source === "fallback" && !result.error && (
          <p className="mt-2 text-xs text-slate-500">The AI helper was not available, so only simple commands were understood.</p>
        )}
      </div>
    </section>
  );
}