"use client";

import { useMemo, useRef } from "react";
import { renderCard } from "@/lib/renderer/renderCard";

/**
 * The card preview, drawn by the SAME renderer the export uses, with a transparent layer on top.
 * Click a box to select it, drag to move it, arrow keys nudge it (handled by the page).
 */
export default function EditorCanvas({ template, data, selectedId, onSelect, onMove }) {
  const { svg, warnings } = useMemo(() => renderCard(template, data), [template, data]);
  const { width, height } = template.canvas;
  const overlay = useRef(null);
  const drag = useRef(null);

  const toUnits = (e) => {
    const el = overlay.current;
    const pt = el.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    return pt.matrixTransform(el.getScreenCTM().inverse());
  };

  function down(e, layer) {
    e.stopPropagation();
    onSelect(layer.id);
    const p = toUnits(e);
    drag.current = { id: layer.id, sx: p.x, sy: p.y, ox: layer.x, oy: layer.y, key: `drag-${Date.now()}` };
    try {
      e.currentTarget.setPointerCapture(e.pointerId); // keeps the drag going when the pointer leaves the box
    } catch {}
  }
  function move(e) {
    const d = drag.current;
    if (!d) return;
    const p = toUnits(e);
    onMove(d.id, Math.round(d.ox + p.x - d.sx), Math.round(d.oy + p.y - d.sy), d.key);
  }
  const up = () => (drag.current = null);

  return (
    <div>
      <div
        className="relative mx-auto w-full max-w-[360px] overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-200"
        style={{ aspectRatio: `${width} / ${height}` }}
      >
        <div className="absolute inset-0 [&>svg]:block [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
        <svg
          ref={overlay}
          viewBox={`0 0 ${width} ${height}`}
          className="absolute inset-0 h-full w-full"
          style={{ touchAction: "none" }}
          onPointerDown={() => onSelect(null)}
          aria-label="Card editing area"
        >
          {template.layers.map((l) => (
            <rect
              key={l.id}
              data-layer={l.id}
              x={l.x}
              y={l.y}
              width={l.w}
              height={l.h}
              fill="transparent"
              stroke={l.id === selectedId ? "#4f46e5" : "none"}
              strokeWidth={2}
              strokeDasharray={l.id === selectedId ? "6 4" : undefined}
              style={{ cursor: "move" }}
              onPointerDown={(e) => down(e, l)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            />
          ))}
        </svg>
      </div>
      {warnings.some((w) => w.kind === "overflow") && (
        <p className="mx-auto mt-2 max-w-[360px] text-xs text-amber-700">
          Some text is too long for its box and was shortened. Make the box wider or the text smaller.
        </p>
      )}
    </div>
  );
}