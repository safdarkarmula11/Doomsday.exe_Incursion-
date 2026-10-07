const STEPS = ["Describe", "Questions", "Drafts", "Editor", "Export"];

/** Progress bar shown at the top of every wizard page. current = index of the active step (0-4). */
export default function Stepper({ current = 0 }) {
  return (
    <ol className="mb-8 flex items-center gap-2 text-sm" aria-label="Progress">
      {STEPS.map((label, i) => {
        const state = i < current ? "done" : i === current ? "current" : "todo";
        const circle =
          state === "current"
            ? "bg-indigo-600 text-white"
            : state === "done"
              ? "bg-indigo-100 text-indigo-700"
              : "bg-slate-200 text-slate-500";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${circle}`}>
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={`${state === "current" ? "font-semibold text-slate-900" : "hidden text-slate-500 sm:inline"}`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 hidden h-px w-6 bg-slate-300 sm:block" aria-hidden="true" />}
          </li>
        );
      })}
    </ol>
  );
}