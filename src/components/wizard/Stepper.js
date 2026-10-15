"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Check } from "lucide-react";

const STEPS = ["Describe", "Questions", "Drafts", "Editor", "People", "Export"];
const PATHS = ["questions", "questions", "drafts", "editor", "people", "export"];

/** Progress bar shown at the top of every wizard page. current = index of the active step (0-5). Finished steps are links. */
export default function Stepper({ current = 0 }) {
  const params = useParams();
  const id = params?.id;

  return (
    <ol className="mb-8 flex items-center text-sm" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const circle =
          state === "current"
            ? "bg-indigo-600 text-white ring-4 ring-indigo-100"
            : state === "done"
              ? "bg-indigo-600 text-white"
              : "border border-slate-300 bg-white text-slate-500";
        const href = i === 0 ? "/projects/new" : id ? `/projects/${id}/${PATHS[i]}` : null;
        const inner = (
          <>
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
              {state === "done" ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={`${
                state === "current" ? "font-semibold text-indigo-700" : "hidden text-slate-500 md:inline"
              } whitespace-nowrap`}
            >
              {label}
            </span>
          </>
        );
        return (
          <li
            key={label}
            className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}
            aria-current={state === "current" ? "step" : undefined}
          >
            {state === "done" && href ? (
              <Link href={href} className="flex items-center gap-2 hover:opacity-80" title={`Back to ${label}`}>
                {inner}
              </Link>
            ) : (
              <span className="flex items-center gap-2">{inner}</span>
            )}
            {i < STEPS.length - 1 && (
              <span
                className={`mx-1 h-px min-w-1 flex-1 sm:mx-3 sm:min-w-3 ${i < current ? "bg-indigo-600" : "bg-slate-300"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}