"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, QrCode, Ruler } from "lucide-react";
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
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <Stepper current={0} />

        <div className="card mt-6 p-5 sm:p-8">
          <p className="eyebrow">Batch workflow</p>
          <h1 className="page-title mt-1">What do you need?</h1>
          <p className="page-sub">
            Describe your event in plain English. We will read it, then ask only for what is missing.
          </p>

          <form onSubmit={submit} className="mt-6">
            <label htmlFor="request" className="field-label">
              Your request
            </label>
            <div className="rounded-xl bg-slate-50 p-1 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-600">
              <textarea
                id="request"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={6}
                maxLength={2000}
                disabled={loading}
                placeholder="ID cards for our 24-hour hackathon, with separate looks for participants, organizers and mentors..."
                className="block w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:text-slate-500"
              />
              <p className="px-3 pb-2 text-right font-mono text-[11px] text-slate-500" aria-hidden="true">
                {text.length} / 2000 chars
              </p>
            </div>

            <div className="mt-5">
              <p className="eyebrow !text-slate-500">Try an example</p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    disabled={loading}
                    onClick={() => setText(ex)}
                    className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2.5 text-left text-xs leading-relaxed text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50"
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
              className="btn-primary mt-6 w-full py-2.5 disabled:cursor-wait"
            >
              {loading ? "Reading your request..." : "Continue"}
            </button>
            {loading && <p className="mt-2 text-center text-xs text-slate-500">This can take a few seconds.</p>}
          </form>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            [Ruler, "CR80 card size", "54 x 85.6 mm cards with 3 mm bleed and crop marks."],
            [QrCode, "QR codes and roles", "Role colours and QR codes for every person."],
            [Printer, "300 DPI export", "PNG at 300 DPI, plus A4 and A3 print sheets."],
          ].map(([Icon, title, text]) => (
            <div key={title} className="card p-4">
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-indigo-700">
                <Icon className="h-4 w-4" aria-hidden="true" />
                {title}
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}