"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Stepper from "@/components/wizard/Stepper";

const EXAMPLES = [
  "We are hosting a 24-hour hackathon on 18 October at SVNIT with about 200 participants, 20 mentors and 15 organizers.",
  "ID cards for our two-day Web Development Workshop on 14 October in Seminar Hall for around 120 attendees.",
];

export default function NewProjectPage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (text.trim().length < 10) {
      setError("Describe your event in a sentence or two.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      router.push(`/projects/${data.id}/questions`); // stay in the loading state until the page changes
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <Stepper current={0} />

        <h1 className="text-2xl font-bold">What do you need?</h1>
        <p className="mt-1 text-slate-600">
          Describe your event in plain English. We will read it, then ask only for what is missing.
        </p>

        <form onSubmit={submit} className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <label htmlFor="request" className="block text-sm font-medium">
            Your request
          </label>
          <textarea
            id="request"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            maxLength={2000}
            disabled={loading}
            placeholder="ID cards for our 24-hour hackathon, with separate looks for participants, organizers and mentors..."
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-100"
          />

          <div className="mt-3">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Try an example</p>
            <div className="mt-2 flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  disabled={loading}
                  onClick={() => setText(ex)}
                  className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-left text-xs text-slate-600 hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-5 w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-indigo-400"
          >
            {loading ? "Reading your request..." : "Continue"}
          </button>
          {loading && <p className="mt-2 text-center text-xs text-slate-500">This can take a few seconds.</p>}
        </form>
      </div>
    </main>
  );
}