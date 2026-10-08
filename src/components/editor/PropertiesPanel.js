"use client";

import ColorField from "@/components/editor/ColorField";
import { EDITABLE, FONT_OPTIONS, layerLabel } from "@/lib/editorConfig";

const PLACEHOLDERS = "{{name}} {{role}} {{idNumber}} {{eventName}} {{eventSubtitle}} {{eventDate}} {{venue}}";

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
    </label>
  );
}

/** Edit one layer. layer = the layer as drawn now; has = which properties were changed from the template. */
export default function PropertiesPanel({ layer, hasChanges, roleColor, onChange, onReset }) {
  const props = EDITABLE[layer.type] ?? [];
  const set = (key, value) => onChange(layer.id, { [key]: value }, `${layer.id}:${key}`);
  const has = (k) => props.includes(k);

  return (
    <section aria-label="Selected element" className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{layerLabel(layer.id)}</h3>
        <button
          type="button"
          onClick={() => onReset(layer.id)}
          disabled={!hasChanges}
          className="text-xs font-medium text-indigo-600 hover:underline disabled:cursor-default disabled:text-slate-400 disabled:no-underline"
        >
          Reset this element
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {has("text") && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Text</span>
            <input
              value={layer.text ?? ""}
              onChange={(e) => set("text", e.target.value)}
              maxLength={200}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 font-mono text-xs"
            />
            <span className="mt-1 block text-xs text-slate-500">
              Words in double braces are filled in for each person: {PLACEHOLDERS}
            </span>
          </label>
        )}

        {has("font") && (
          <label className="block">
            <span className="block text-xs font-medium text-slate-600">Font</span>
            <select
              value={FONT_OPTIONS.some((f) => f.value === layer.font) ? layer.font : ""}
              onChange={(e) => e.target.value && set("font", e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            >
              <option value="">Template font</option>
              {FONT_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {(has("size") || has("weight")) && (
          <div className="grid grid-cols-2 gap-3">
            {has("size") && <NumberField label="Size" value={layer.size} min={4} max={400} onChange={(v) => set("size", v)} />}
            {has("weight") && (
              <label className="block">
                <span className="block text-xs font-medium text-slate-600">Weight</span>
                <select
                  value={layer.weight ?? 400}
                  onChange={(e) => set("weight", Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value={400}>Regular</option>
                  <option value={600}>Semi-bold</option>
                  <option value={700}>Bold</option>
                </select>
              </label>
            )}
          </div>
        )}

        {has("align") && (
          <div role="group" aria-label="Alignment" className="flex gap-1">
            {["left", "center", "right"].map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={(layer.align ?? "left") === a}
                onClick={() => set("align", a)}
                className={`flex-1 rounded-lg border px-2 py-1 text-xs capitalize ${
                  (layer.align ?? "left") === a ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 hover:bg-slate-50"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}

        {(has("color") || has("fill")) && (
          <div className="grid grid-cols-2 gap-3">
            {has("color") && (
              <ColorField label="Text colour" value={layer.color ?? "#111111"} allowRole roleColor={roleColor} onChange={(v) => set("color", v)} />
            )}
            {has("fill") && (
              <ColorField label="Fill colour" value={layer.fill ?? "#ffffff"} allowRole roleColor={roleColor} onChange={(v) => set("fill", v)} />
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          {["x", "y", "w", "h"].map(
            (k) =>
              has(k) && (
                <NumberField
                  key={k}
                  label={{ x: "Left", y: "Top", w: "Width", h: "Height" }[k]}
                  value={layer[k]}
                  min={k === "w" || k === "h" ? 1 : -2000}
                  max={4000}
                  onChange={(v) => set(k, v)}
                />
              )
          )}
        </div>
      </div>
    </section>
  );
}