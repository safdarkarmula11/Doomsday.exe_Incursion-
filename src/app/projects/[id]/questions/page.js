"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import Stepper from "@/components/wizard/Stepper";
import {
  FIELD_OPTIONS,
  ROLE_PRESETS,
  eventDataToForm,
  formToEventData,
  validateEventData,
} from "@/lib/eventData";

const TONES = {
  green: "chip-ok",
  amber: "chip-warn",
  red: "chip-error",
  gray: "chip-neutral",
};

/** The little label next to each field: what we found, what needs checking, what is missing. */
function badgeFor(key, meta, filled) {
  const missing = meta.missing ?? [];
  const confirm = meta.confirm ?? [];
  if (confirm.includes(key)) return { text: "Please confirm", tone: "amber" };
  if (key === "fieldsToShow") return { text: "Your choice", tone: "gray" };
  if (missing.includes(key)) {
    if (filled[key]) return { text: "Added", tone: "green" }; // was missing, the user has now filled it in
    return key === "tagline" ? { text: "Optional", tone: "gray" } : { text: "Needed", tone: "red" };
  }
  return { text: "Found in your request", tone: "green" };
}

function Field({ id, label, badge, error, hint, children }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="field-label !mb-0">
          {label}
        </label>
        {badge && <span className={TONES[badge.tone]}>{badge.text}</span>}
      </div>
      <div className="mt-1">{children}</div>
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

const inputClass = (hasError) =>
  `field ${hasError ? "!border-red-400 bg-red-50/40" : ""}`;

export default function QuestionsPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loadError, setLoadError] = useState("");
  const [meta, setMeta] = useState(null);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [topError, setTopError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch(`/api/projects/${id}`, { signal: controller.signal });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load this project.");
        setMeta(data.project.eventData?._meta ?? {});
        setForm(eventDataToForm(data.project.eventData));
      } catch (e) {
        if (e.name !== "AbortError") setLoadError(e.message);
      }
    })();
    return () => controller.abort();
  }, [id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRole = (i, patch) => set({ roles: form.roles.map((r, n) => (n === i ? { ...r, ...patch } : r)) });
  const addRole = (name = "") => set({ roles: [...form.roles, { name, count: "" }] });
  const removeRole = (i) => set({ roles: form.roles.filter((_, n) => n !== i) });
  const toggleField = (key) =>
    set({
      fieldsToShow: form.fieldsToShow.includes(key)
        ? form.fieldsToShow.filter((k) => k !== key)
        : [...form.fieldsToShow, key],
    });

  async function save(e) {
    e.preventDefault();
    setTopError("");

    const { eventData, errors: formErrors } = formToEventData(form);
    const checked = validateEventData(eventData);
    const found = { ...(checked.ok ? {} : checked.errors), ...formErrors };
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setTopError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventData }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.fields) setErrors(data.fields);
      if (!res.ok) throw new Error(data.error || "Could not save. Please try again.");
      router.push(`/projects/${id}/drafts`);
    } catch (err) {
      setTopError(err.message);
      setSaving(false);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen text-slate-900">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError}
          </p>
          <Link href="/projects/new" className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline">
            Start a new project
          </Link>
        </div>
      </main>
    );
  }

  if (!form) {
    return (
      <main className="min-h-screen text-slate-900">
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading...</div>
      </main>
    );
  }

  const showsQr = form.fieldsToShow.includes("qr");
  const filled = {
    eventName: form.eventName.trim() !== "",
    tagline: form.tagline.trim() !== "",
    date: form.date.trim() !== "",
    venue: form.venue.trim() !== "",
    roles: form.roles.some((r) => r.name.trim() !== ""),
  };

  return (
    <main className="min-h-screen text-slate-900">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
        <Stepper current={1} />

        <p className="eyebrow mt-6">Step 2 / Questions</p>
        <h1 className="page-title mt-1">Check the details</h1>
        <p className="page-sub">
          Here is what we understood. Fix anything that is wrong and fill in what is missing.
        </p>

        {meta?.source === "fallback" && (
          <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            The AI helper was not available, so only the basic details were read. Please check everything carefully.
          </p>
        )}

        {meta?.request && (
          <details className="card mt-4 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium text-slate-700">Your request</summary>
            <p className="mt-2 text-slate-600">{meta.request}</p>
          </details>
        )}

        <form onSubmit={save} noValidate className="card-pad mt-6 space-y-6 sm:p-6">
          <Field id="eventName" label="Event name" badge={badgeFor("eventName", meta, filled)} error={errors.eventName}>
            <input
              id="eventName"
              value={form.eventName}
              onChange={(e) => set({ eventName: e.target.value })}
              placeholder="e.g. HackSVNIT 2026"
              className={inputClass(errors.eventName)}
            />
          </Field>

          <Field
            id="tagline"
            label="Tagline"
            badge={badgeFor("tagline", meta, filled)}
            error={errors.tagline}
            hint="Leave empty if you do not want one on the card."
          >
            <input
              id="tagline"
              value={form.tagline}
              onChange={(e) => set({ tagline: e.target.value })}
              placeholder="e.g. Build. Break. Ship."
              className={inputClass(errors.tagline)}
            />
          </Field>

          <div className="grid gap-6 sm:grid-cols-2">
            <Field id="date" label="Date" badge={badgeFor("date", meta, filled)} error={errors.date}>
              <input
                id="date"
                value={form.date}
                onChange={(e) => set({ date: e.target.value })}
                placeholder="e.g. 18 October 2026"
                className={inputClass(errors.date)}
              />
            </Field>
            <Field id="venue" label="Venue" badge={badgeFor("venue", meta, filled)} error={errors.venue}>
              <input
                id="venue"
                value={form.venue}
                onChange={(e) => set({ venue: e.target.value })}
                placeholder="e.g. SVNIT"
                className={inputClass(errors.venue)}
              />
            </Field>
          </div>

          <Field
            id="role-0"
            label="Roles on the cards"
            badge={badgeFor("roles", meta, filled)}
            error={errors.roles}
            hint="Each role gets its own colour. The count is optional."
          >
            <div className="space-y-2">
              {form.roles.map((r, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    id={`role-${i}`}
                    aria-label={`Role ${i + 1} name`}
                    value={r.name}
                    onChange={(e) => setRole(i, { name: e.target.value })}
                    placeholder="role, e.g. mentor"
                    className={inputClass(false)}
                  />
                  <input
                    aria-label={`Role ${i + 1} count`}
                    value={r.count}
                    onChange={(e) => setRole(i, { count: e.target.value })}
                    inputMode="numeric"
                    placeholder="count"
                    className={`${inputClass(false)} !w-24`}
                  />
                  <button
                    type="button"
                    onClick={() => removeRole(i)}
                    aria-label={`Remove role ${i + 1}`}
                    className="btn-secondary !px-3 !text-slate-500"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_PRESETS.filter((p) => !form.roles.some((r) => r.name.trim().toLowerCase() === p)).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => addRole(p)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
                >
                  + {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => addRole()}
                className="rounded-full border border-dashed border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700"
              >
                + other role
              </button>
            </div>
          </Field>

          <fieldset>
            <div className="flex items-center justify-between gap-2">
              <legend className="section-title !text-sm">What should be on each card?</legend>
              <span className={TONES.gray}>Your choice</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {FIELD_OPTIONS.map((f) => (
                <label
                  key={f.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm transition hover:border-slate-300 has-[:checked]:border-indigo-300 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="checkbox"
                    checked={f.locked || form.fieldsToShow.includes(f.key)}
                    disabled={f.locked}
                    onChange={() => toggleField(f.key)}
                    className="h-4 w-4 accent-indigo-600"
                  />
                  {f.label}
                  {f.locked && <span className="mono ml-auto text-slate-400">always</span>}
                </label>
              ))}
            </div>
            {errors.fieldsToShow && (
              <p role="alert" className="mt-1 text-xs font-medium text-red-600">
                {errors.fieldsToShow}
              </p>
            )}
          </fieldset>

          {showsQr && (
            <Field
              id="qrBaseUrl"
              label="Attendance link for the QR code"
              error={errors.qrBaseUrl}
              hint="Each card's QR points to this link plus the person's ID. The built-in check-in page marks people as arrived when staff scan their card."
            >
              <input
                id="qrBaseUrl"
                value={form.qrBaseUrl}
                onChange={(e) => set({ qrBaseUrl: e.target.value })}
                placeholder="https://example.com/attend"
                className={inputClass(errors.qrBaseUrl)}
              />
              <button
                type="button"
                onClick={() => set({ qrBaseUrl: `${window.location.origin}/checkin/${id}` })}
                className="mt-2 text-sm font-medium text-indigo-600 hover:underline"
              >
                Use this app&apos;s built-in check-in page
              </button>
            </Field>
          )}

          {topError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {topError}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <Link href="/projects/new" className="btn-secondary">
              <ArrowLeft size={16} aria-hidden="true" />
              Back
            </Link>
            <button type="submit" disabled={saving} className="btn-primary !px-5 !py-2.5 disabled:cursor-wait">
              {saving ? "Saving..." : "Save and see designs"}
              {!saving && <ArrowRight size={16} aria-hidden="true" />}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}