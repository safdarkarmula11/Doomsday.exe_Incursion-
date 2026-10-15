"use client";

import { SlidersHorizontal } from "lucide-react";
import ColorField from "@/components/editor/ColorField";
import { EDITABLE, FONT_OPTIONS, layerLabel } from "@/lib/editorConfig";

const PLACEHOLDERS = "{{name}} {{role}} {{idNumber}} {{eventName}} {{eventSubtitle}} {{eventDate}} {{venue}}";

function NumberField({ label, value, onChange, min, max, step = 1 }) {
  return (
    <label className="block">
      <span className="field-label !mb-0">{label}</span>
      <input
        type="number"
        value={Number.isFinite(value) ? value : ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => e.target.value !== "" && onChange(Number(e.target.value))}
        className="field mt-1 font-mono"
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
    <section aria-label="Selected element" className="card-pad !p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="section-title flex min-w-0 items-center gap-2 truncate">
          <SlidersHorizontal size={16} className="shrink-0 text-indigo-600" aria-hidden="true" />
          <span className="truncate">{layerLabel(layer.id)}</span>
        </h3>
        <button
          type="button"
          onClick={() => onReset(layer.id)}
          disabled={!hasChanges}
          className="btn-ghost btn-sm shrink-0 text-indigo-600 disabled:text-slate-400"
        >
          Reset this element
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {has("text") && (
          <label className="block">
            <span className="field-label !mb-0">Text</span>
            <input
              value={layer.text ?? ""}
              onChange={(e) => set("text", e.target.value)}
              maxLength={200}
              className="field mt-1 font-mono !text-xs"
            />
            <span className="mt-1 block font-mono text-[11px] text-slate-500">
              Words in double braces are filled in for each person: {PLACEHOLDERS}
            </span>
          </label>
        )}

        {has("font") && (
          <label className="block">
            <span className="field-label !mb-0">Font</span>
            <select
              value={FONT_OPTIONS.some((f) => f.value === layer.font) ? layer.font : ""}
              onChange={(e) => e.target.value && set("font", e.target.value)}
              className="field mt-1"
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
                <span className="field-label !mb-0">Weight</span>
                <select
                  value={layer.weight ?? 400}
                  onChange={(e) => set("weight", Number(e.target.value))}
                  className="field mt-1"
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
          <div role="group" aria-label="Alignment" className="flex gap-1 rounded-lg bg-slate-100 p-0.5">
            {["left", "center", "right"].map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={(layer.align ?? "left") === a}
                onClick={() => set("align", a)}
                className={`h-8 flex-1 rounded-md px-2 text-xs font-medium capitalize ${
                  (layer.align ?? "left") === a ? "bg-white text-indigo-700 shadow-sm ring-1 ring-indigo-200" : "text-slate-600 hover:bg-white/60"
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