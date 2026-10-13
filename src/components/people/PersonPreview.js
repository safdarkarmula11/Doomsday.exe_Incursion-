"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { renderCard } from "@/lib/renderer/renderCard";
import { applyFields, cardData, personToCard } from "@/lib/cardData";
import { applyConfig } from "@/lib/editorConfig";

const describe = (w) =>
  w.kind === "overflow"
    ? "The text in one box is too long and was shortened."
    : w.kind === "missing" && w.field === "qrUrl"
      ? "No QR code, because this person has no ID."
      : w.kind === "missing" && w.field === "photo"
      ? "No photo, so initials are shown."
      : w.kind === "missing"
        ? `Nothing to show for "${w.field}".`
        : "";

/** Shows what a real person's card will look like, using the design chosen in the editor. */
export default function PersonPreview({ projectId, people }) {
  const [design, setDesign] = useState(null); // { template, eventData }
  const [problem, setProblem] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const list = await fetch(`/api/projects/${projectId}/drafts`).then((r) => r.json());
        if (!list.selectedId) return !off && setProblem("Choose a design first to see the cards.");
        const res = await fetch(`/api/projects/${projectId}/drafts/${list.selectedId}`);
        const d = await res.json();
        if (!res.ok) throw new Error(d.error);
        if (!off) setDesign({ template: applyConfig(applyFields(d.template, d.eventData.fieldsToShow), d.config), eventData: d.eventData });
      } catch {
        if (!off) setProblem("Could not load the design.");
      }
    })();
    return () => {
      off = true;
    };
  }, [projectId]);

  const person = people[Math.min(index, people.length - 1)];
  const out = useMemo(
    () => (design && person ? renderCard(design.template, cardData(design.eventData, personToCard(person))) : null),
    [design, person]
  );
  const notes = out ? [...new Set(out.warnings.map(describe).filter(Boolean))] : [];

  if (problem) {
    return (
      <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {problem}{" "}
        <Link href={`/projects/${projectId}/drafts`} className="font-medium underline">
          Go to the designs
        </Link>
      </p>
    );
  }
  if (!out) return <p className="text-sm text-slate-500">Loading the card...</p>;

  return (
    <div className="grid gap-4 sm:grid-cols-[220px_1fr] sm:items-start">
      <div
        className="mx-auto w-full max-w-[220px] overflow-hidden rounded-md shadow-md ring-1 ring-slate-200 [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        role="img"
        aria-label={`Card for ${person.name}`}
        dangerouslySetInnerHTML={{ __html: out.svg }}
      />
      <div>
        <label className="block text-sm">
          <span className="block text-xs font-medium text-slate-600">See the card for</span>
          <select
            value={index}
            onChange={(e) => setIndex(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {people.map((p, i) => (
              <option key={p.id} value={i}>
                {p.name} ({p.role})
              </option>
            ))}
          </select>
        </label>
        {notes.length > 0 && (
          <ul className="mt-3 list-disc pl-5 text-xs text-amber-700">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Not happy with it?{" "}
          <Link href={`/projects/${projectId}/editor`} className="font-medium text-indigo-600 underline">
            Go back to the editor
          </Link>
        </p>
      </div>
    </div>
  );
}