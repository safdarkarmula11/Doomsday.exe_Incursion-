"use client";

import { useEffect, useRef, useState } from "react";
import { HexColorPicker } from "react-colorful";

/** A colour swatch that opens a picker. value is "#rrggbb" or "$role" (= use each person's role colour). */
export default function ColorField({ label, value, onChange, allowRole = false, roleColor = "#64748b" }) {
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  const isRole = value === "$role";
  const shown = isRole ? roleColor : value;

  useEffect(() => {
    if (!open) return;
    const close = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const typed = (e) => {
    let v = e.target.value.trim();
    if (!v.startsWith("#")) v = "#" + v;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v.toLowerCase());
  };

  return (
    <div className="relative" ref={box}>
      <span className="block text-xs font-medium text-slate-600">{label}</span>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${label}: ${isRole ? "role colour" : value}`}
        className="mt-1 flex w-full items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left text-sm hover:border-indigo-400"
      >
        <span className="h-5 w-5 rounded border border-slate-300" style={{ background: shown }} />
        <span className="font-mono text-xs text-slate-700">{isRole ? "role colour" : value}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
          <HexColorPicker color={shown} onChange={(c) => onChange(c.toLowerCase())} style={{ width: "100%", height: 140 }} />
          <input
            key={shown}
            defaultValue={shown}
            onChange={typed}
            aria-label={`${label} hex code`}
            className="mt-2 w-full rounded border border-slate-300 px-2 py-1 font-mono text-xs"
          />
          {allowRole && (
            <button
              type="button"
              onClick={() => {
                onChange("$role");
                setOpen(false);
              }}
              className={`mt-2 w-full rounded border px-2 py-1 text-xs ${
                isRole ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-300 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Use the role colour
            </button>
          )}
        </div>
      )}
    </div>
  );
}