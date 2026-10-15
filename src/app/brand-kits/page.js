"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ColorField from "@/components/editor/ColorField";
import { FONT_OPTIONS } from "@/lib/editorConfig";
import { DEFAULT_KIT, MAX_LOGO_BYTES, applyBrand } from "@/lib/brand";
import { renderCard } from "@/lib/renderer/renderCard";
import { cardData, samplePerson } from "@/lib/cardData";
import { templates } from "@/lib/templates";

const SAMPLE_EVENT = { eventName: "Your event", tagline: "Your tagline", date: "1 January 2027", venue: "Venue", qrBaseUrl: "https://example.com/checkin" };
const input = "field mt-1";
const btnPrimary = "btn btn-primary";
const btnLight = "btn btn-secondary";

const blank = () => ({
  id: null,
  name: "",
  left: { url: DEFAULT_KIT.logos.left.url, label: DEFAULT_KIT.logos.left.label },
  right: { url: DEFAULT_KIT.logos.right.url, label: DEFAULT_KIT.logos.right.label },
  roles: [
    { role: "participant", color: "#2563eb" },
    { role: "organizer", color: "#dc2626" },
    { role: "mentor", color: "#7c3aed" },
    { role: "volunteer", color: "#059669" },
  ],
  heading: "",
  body: "",
  isDefault: false,
  usedBy: 0,
});

const fromKit = (k) => ({
  id: k.id,
  name: k.name,
  left: { ...k.logos.left },
  right: { ...k.logos.right },
  roles: Object.entries(k.roleColors).map(([role, color]) => ({ role, color })),
  heading: k.fonts.heading,
  body: k.fonts.body,
  isDefault: k.isDefault,
  usedBy: k.usedBy ?? 0,
});

const toBody = (f) => ({
  name: f.name,
  logos: { left: f.left, right: f.right },
  roleColors: Object.fromEntries(f.roles.filter((r) => r.role.trim()).map((r) => [r.role.trim().toLowerCase(), r.color])),
  fonts: { heading: f.heading, body: f.body },
});

export default function BrandKitsPage() {
  const [kits, setKits] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [previewRole, setPreviewRole] = useState("");
  const started = useRef(false);

  async function load(selectId) {
    const res = await fetch("/api/brand-kits");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Could not load the brand kits.");
    setKits(d.kits);
    const pick = d.kits.find((k) => k.id === selectId) ?? d.kits[0];
    setForm(pick ? fromKit(pick) : blank());
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    load().catch((e) => setError(e.message));
  }, []);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setRow = (i, patch) => setForm((f) => ({ ...f, roles: f.roles.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));

  function pickFile(side, file) {
    if (!file) return;
    setError("");
    if (!/^image\/(png|jpeg|webp|gif|svg\+xml)$/.test(file.type)) return setError("Use a PNG, JPG, WebP or SVG file.");
    if (file.size > MAX_LOGO_BYTES) return setError(`That file is ${Math.round(file.size / 1000)} KB. Logos can be 300 KB at most.`);
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, [side]: { url: String(reader.result), label: f[side].label || file.name.replace(/\.[^.]+$/, "") } }));
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsDataURL(file);
  }

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(form.id ? `/api/brand-kits/${form.id}` : "/api/brand-kits", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toBody(form)),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Could not save.");
      await load(d.kit.id);
      setNotice("Saved.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete "${form.name}"? Events that use it go back to the default kit.`)) return;
    setError("");
    const res = await fetch(`/api/brand-kits/${form.id}`, { method: "DELETE" });
    if (!res.ok) return setError((await res.json().catch(() => ({}))).error || "Could not delete.");
    setNotice("Deleted.");
    await load();
  }

  const roleNames = form ? form.roles.map((r) => r.role.trim().toLowerCase()).filter(Boolean) : [];
  const shownRole = roleNames.includes(previewRole) ? previewRole : roleNames[0] ?? "participant";
  let preview = "";
  if (form) {
    const kit = {
      logos: { left: { url: form.left.url || DEFAULT_KIT.logos.left.url }, right: { url: form.right.url || DEFAULT_KIT.logos.right.url } },
      roleColors: Object.fromEntries(form.roles.filter((r) => r.role.trim()).map((r) => [r.role.trim().toLowerCase(), r.color])),
      fonts: { heading: form.heading, body: form.body },
    };
    preview = renderCard(applyBrand(templates[0], kit), cardData(SAMPLE_EVENT, samplePerson(shownRole))).svg;
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <nav className="eyebrow flex flex-wrap gap-x-3 gap-y-1">
          <Link href="/" className="hover:underline">Home</Link>
          <span className="text-slate-400" aria-hidden="true">/</span>
          <span className="text-slate-900">Brand kits</span>
          <span className="text-slate-400" aria-hidden="true">/</span>
          <Link href="/templates" className="hover:underline">Templates</Link>
        </nav>
        <h1 className="page-title mt-3">Brand kits</h1>
        <p className="page-sub max-w-2xl">
          A brand kit holds the logos, role colours and fonts of an event. Each event picks one on its Designs page, and every card uses it.
        </p>

        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</p>}
        {!kits && !error && <p className="mt-6 text-sm text-slate-500">Loading...</p>}

        {kits && form && (
          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[280px_1fr]">
            <aside className="card-pad lg:sticky lg:top-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="section-title">Configured kits</h2>
                <span className="chip-neutral mono">{kits.length}</span>
              </div>
              <ul className="space-y-1.5">
                {kits.map((k) => (
                  <li key={k.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setForm(fromKit(k));
                        setNotice("");
                        setError("");
                      }}
                      aria-current={form.id === k.id}
                      className={`w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${form.id === k.id ? "border-indigo-300 bg-indigo-50 ring-1 ring-indigo-200" : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-slate-50"}`}
                    >
                      <span className="block font-display font-semibold text-slate-900">{k.name}</span>
                      <span className="mono block text-[11px] text-slate-500">
                        {k.isDefault ? "Default · " : ""}
                        {k.usedBy} {k.usedBy === 1 ? "event" : "events"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => {
                  setForm(blank());
                  setNotice("");
                  setError("");
                }}
                className={`${btnLight} mt-3 w-full`}
              >
                New brand kit
              </button>
            </aside>

            <section className="card-pad sm:p-6">
              <div className="grid gap-8 xl:grid-cols-[1fr_260px]">
                <div className="min-w-0">
                  <label className="block text-sm">
                    <span className="field-label">Name</span>
                    <input value={form.name} onChange={(e) => set({ name: e.target.value })} className="field" placeholder="e.g. HackSVNIT 2026" />
                  </label>

                  <h2 className="section-title mt-7">Logos</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Shown at the top of every card. PNG, JPG, WebP or SVG, up to 300 KB. A PNG with a transparent background looks best.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {["left", "right"].map((side) => (
                      <div key={side} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            {form[side].url && <img src={form[side].url} alt={`${side} logo`} className="max-h-12 max-w-[72px] object-contain" />}
                          </div>
                          <span className="eyebrow capitalize">{side} logo</span>
                        </div>
                        <input
                          value={form[side].label}
                          onChange={(e) => set({ [side]: { ...form[side], label: e.target.value } })}
                          className={input}
                          placeholder="Name, e.g. ACM NIT Surat"
                          aria-label={`${side} logo name`}
                        />
                        <div className="mt-2 rounded-lg border border-dashed border-slate-300 bg-white px-2 py-2">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                            onChange={(e) => pickFile(side, e.target.files?.[0])}
                            aria-label={`Upload the ${side} logo`}
                            className="w-full text-xs text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-indigo-50 file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-indigo-700"
                          />
                        </div>
                        <input
                          value={form[side].url.startsWith("data:") ? "" : form[side].url}
                          onChange={(e) => set({ [side]: { ...form[side], url: e.target.value.trim() } })}
                          className={`${input} font-mono text-xs`}
                          placeholder={form[side].url.startsWith("data:") ? "Uploaded file (or paste a link to replace it)" : "or paste a link, e.g. https://..."}
                          aria-label={`${side} logo link`}
                        />
                      </div>
                    ))}
                  </div>

                  <h2 className="section-title mt-7">Role colours</h2>
                  <p className="mt-0.5 text-xs text-slate-500">Each role gets its own colour on every card. A role not listed here keeps the design&apos;s own colour.</p>
                  <div className="mt-3 space-y-2">
                    {form.roles.map((r, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2.5">
                        <label className="block min-w-[8rem] flex-1 text-sm">
                          <span className="field-label">Role</span>
                          <input value={r.role} onChange={(e) => setRow(i, { role: e.target.value })} className="field" placeholder="e.g. speaker" />
                        </label>
                        <div className="w-40">
                          <ColorField label="Colour" value={r.color} onChange={(color) => setRow(i, { color })} />
                        </div>
                        <button type="button" onClick={() => set({ roles: form.roles.filter((_, k) => k !== i) })} className={`${btnLight} btn-sm h-9`} aria-label={`Remove ${r.role || "this role"}`}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => set({ roles: [...form.roles, { role: "", color: "#0d9488" }] })} className={`${btnLight} mt-2 w-full border-dashed`}>
                    Add a role
                  </button>

                  <h2 className="section-title mt-7">Fonts</h2>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["heading", "Headings (event name, person's name)"],
                      ["body", "Everything else"],
                    ].map(([key, label]) => (
                      <label key={key} className="block text-sm">
                        <span className="field-label">{label}</span>
                        <select value={form[key]} onChange={(e) => set({ [key]: e.target.value })} className="field">
                          <option value="">Keep the design&apos;s font</option>
                          {FONT_OPTIONS.map((f) => (
                            <option key={f.value} value={f.value}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>

                  <div className="mt-7 flex flex-wrap gap-2 border-t border-slate-200 pt-5">
                    <button type="button" onClick={save} disabled={saving} className={btnPrimary}>
                      {saving ? "Saving..." : form.id ? "Save changes" : "Create brand kit"}
                    </button>
                    {form.id && !form.isDefault && (
                      <button type="button" onClick={remove} className="btn btn-danger">
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                <div className="min-w-0 xl:sticky xl:top-4 xl:self-start">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="eyebrow mb-3">Preview</p>
                    <div
                      className="card-stage mx-auto max-w-[260px] [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
                      role="img"
                      aria-label="Preview of the card with this brand kit"
                      dangerouslySetInnerHTML={{ __html: preview }}
                    />
                    {roleNames.length > 1 && (
                      <label className="mt-4 block text-sm">
                        <span className="field-label">Preview role</span>
                        <select value={shownRole} onChange={(e) => setPreviewRole(e.target.value)} className="field">
                          {[...new Set(roleNames)].map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}