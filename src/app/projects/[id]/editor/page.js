"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, BookmarkPlus, Eye, EyeOff, Layers, Redo2, RotateCcw, Undo2 } from "lucide-react";
import Stepper from "@/components/wizard/Stepper";
import EditorCanvas from "@/components/editor/EditorCanvas";
import PropertiesPanel from "@/components/editor/PropertiesPanel";
import ColorField from "@/components/editor/ColorField";
import RefineBox from "@/components/editor/RefineBox";
import { applyFields, cardData, samplePerson } from "@/lib/cardData";
import { EMPTY_CONFIG, applyConfig, layerLabel } from "@/lib/editorConfig";

const HISTORY_LIMIT = 50;

export default function EditorPage() {
  const { id } = useParams();
  const router = useRouter();

  const [loaded, setLoaded] = useState(null); // { draftId, template, eventData, roles }
  const [error, setError] = useState("");
  const [needsDetails, setNeedsDetails] = useState(false);
  const [role, setRole] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [saveState, setSaveState] = useState("saved"); // saved | saving | error
  const [tplNote, setTplNote] = useState(""); // result of "Save as template"
  const [hist, setHist] = useState({ past: [], present: EMPTY_CONFIG, future: [] });

  // history lives in a ref too, so keyboard handlers and the save timer always see the latest value
  const histRef = useRef(hist);
  const lastChange = useRef({ group: null, t: 0 });
  const started = useRef(false);
  const dirty = useRef(false);
  const saveTimer = useRef(null);

  const setH = (h) => {
    histRef.current = h;
    setHist(h);
  };

  // ---- load ---------------------------------------------------------------
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      try {
        const list = await fetch(`/api/projects/${id}/drafts`);
        const listData = await list.json().catch(() => ({}));
        if (!list.ok) {
          setNeedsDetails(Boolean(listData.needsDetails));
          throw new Error(listData.error || "Could not load the designs.");
        }
        if (!listData.selectedId) throw new Error("Choose a design first.");

        const res = await fetch(`/api/projects/${id}/drafts/${listData.selectedId}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Could not load this design.");

        setLoaded({ draftId: listData.selectedId, template: data.template, eventData: data.eventData, roles: data.roles });
        setRole(data.roles[0]);
        setH({ past: [], present: data.config, future: [] });
      } catch (e) {
        setError(e.message);
      }
    })();
  }, [id]);

  // ---- changing things (with undo/redo) --------------------------------------
  const commit = useCallback((updater, group) => {
    const h = histRef.current;
    const next = updater(h.present);
    if (next === h.present) return;
    const now = Date.now();
    // typing or dragging makes many tiny changes: keep them as ONE undo step
    const merge = group && lastChange.current.group === group && now - lastChange.current.t < 700;
    lastChange.current = { group, t: now };
    setH({ past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT), present: next, future: [] });
    dirty.current = true;
    setSaveState("saving");
  }, []);

  const changeLayer = useCallback(
    (layerId, patch, group) =>
      commit((c) => ({ ...c, layers: { ...c.layers, [layerId]: { ...c.layers[layerId], ...patch } } }), group),
    [commit]
  );

  const undo = useCallback(() => {
    const h = histRef.current;
    if (!h.past.length) return;
    lastChange.current = { group: null, t: 0 };
    setH({ past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] });
    dirty.current = true;
    setSaveState("saving");
  }, []);

  const redo = useCallback(() => {
    const h = histRef.current;
    if (!h.future.length) return;
    lastChange.current = { group: null, t: 0 };
    setH({ past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) });
    dirty.current = true;
    setSaveState("saving");
  }, []);

  // ---- saving ---------------------------------------------------------------
  const save = useCallback(async () => {
    if (!loaded) return true;
    clearTimeout(saveTimer.current);
    setSaveState("saving");
    try {
      const res = await fetch(`/api/projects/${id}/drafts/${loaded.draftId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: histRef.current.present }),
      });
      if (!res.ok) throw new Error();
      dirty.current = false;
      setSaveState("saved");
      return true;
    } catch {
      setSaveState("error");
      return false;
    }
  }, [id, loaded]);

  useEffect(() => {
    if (!dirty.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 900);
    return () => clearTimeout(saveTimer.current);
  }, [hist.present, save]);

  // ---- what to draw -----------------------------------------------------------
  const config = hist.present;
  const fieldFiltered = useMemo(
    () => (loaded ? applyFields(loaded.template, loaded.eventData.fieldsToShow) : null),
    [loaded]
  );
  const effective = useMemo(() => (fieldFiltered ? applyConfig(fieldFiltered, config) : null), [fieldFiltered, config]);
  const data = useMemo(() => (loaded ? cardData(loaded.eventData, samplePerson(role)) : null), [loaded, role]);
  const roleColorOf = (r) => config.roleColors[r] ?? loaded?.template.roleColors[r] ?? "#64748b";

  // ---- keyboard: arrows nudge, Ctrl+Z / Ctrl+Y ----------------------------------
  useEffect(() => {
    function onKey(e) {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (selectedId && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const layer = effective?.layers.find((l) => l.id === selectedId);
        if (!layer) return;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        changeLayer(selectedId, { x: layer.x + dx, y: layer.y + dy }, `nudge-${selectedId}`);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, selectedId, effective, changeLayer]);

  // ---- actions ---------------------------------------------------------------------
  const resetLayer = (layerId) =>
    commit((c) => {
      if (!c.layers[layerId]) return c;
      const layers = { ...c.layers };
      delete layers[layerId];
      return { ...c, layers };
    });
  const toggleHidden = (layerId, hidden) => changeLayer(layerId, { hidden });
  const resetAll = () => {
    if (window.confirm("Remove all your changes and go back to the original design?")) commit(() => EMPTY_CONFIG);
  };
  const setRoleColor = (r, value) =>
    commit((c) => ({ ...c, roleColors: { ...c.roleColors, [r]: value } }), `role-${r}`);

  async function next() {
    if (await save()) router.push(`/projects/${id}/people`);
  }

  // Keeps this design, with all your changes, as a template any event can start from.
  async function saveAsTemplate() {
    const name = window.prompt("Name for the new template:", `${loaded.template.name} (edited)`);
    if (!name?.trim()) return;
    setTplNote("");
    if (!(await save())) return;
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), fromDraftId: loaded.draftId }),
    });
    const d = await res.json().catch(() => ({}));
    setTplNote(res.ok ? `Saved the template "${d.template.name}".` : d.error || "Could not save the template.");
  }

  // ---- screens -------------------------------------------------------------------------
  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-2xl px-4 py-10">
          <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
          <Link
            href={needsDetails ? `/projects/${id}/questions` : `/projects/${id}/drafts`}
            className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            {needsDetails ? "Go to the details" : "Go to the designs"}
          </Link>
        </div>
      </main>
    );
  }
  if (!loaded || !effective) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900">
        <div className="mx-auto max-w-2xl px-4 py-10 text-sm text-slate-500">Loading the editor...</div>
      </main>
    );
  }

  const selected = effective.layers.find((l) => l.id === selectedId) ?? null;
  const statusText = { saved: "All changes saved", saving: "Saving...", error: "Could not save" }[saveState];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1440px] px-4 py-6">
        <Stepper current={3} />

        {/* toolbar */}
        <div className="card flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <h1 className="page-title !text-xl sm:!text-2xl">Edit your design</h1>
            <p className="page-sub !mt-0.5">Click anything on the card to change it. Drag it to move it.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              role="status"
              className={`font-mono text-xs ${saveState === "error" ? "font-medium text-red-600" : "text-slate-500"}`}
            >
              {statusText}
            </span>
            {saveState === "error" && (
              <button type="button" onClick={save} className="btn-ghost btn-sm text-indigo-600">
                Try again
              </button>
            )}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
              <button type="button" onClick={undo} disabled={!hist.past.length} className="btn-ghost btn-sm">
                <Undo2 size={14} aria-hidden="true" />
                Undo
              </button>
              <button type="button" onClick={redo} disabled={!hist.future.length} className="btn-ghost btn-sm">
                <Redo2 size={14} aria-hidden="true" />
                Redo
              </button>
            </div>
            <button type="button" onClick={resetAll} className="btn-ghost btn-sm text-red-600 hover:bg-red-50">
              <RotateCcw size={14} aria-hidden="true" />
              Remove all my changes
            </button>
            <button type="button" onClick={saveAsTemplate} className="btn-ghost btn-sm text-slate-700">
              <BookmarkPlus size={14} aria-hidden="true" />
              Save as template
            </button>
            <Link href={`/projects/${id}/drafts`} className="btn-ghost btn-sm text-slate-700">
              Back to the designs
            </Link>
            <button type="button" onClick={next} disabled={saveState === "saving"} className="btn-primary">
              Continue to people
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
          {tplNote && (
            <p role="status" className="w-full text-xs text-slate-600">
              {tplNote}
            </p>
          )}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[288px_minmax(0,1fr)_320px] lg:items-start">
          {/* left: elements */}
          <section aria-label="Elements" className="card order-2 overflow-hidden lg:order-1">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h3 className="section-title flex items-center gap-2">
                <Layers size={16} className="text-indigo-600" aria-hidden="true" />
                Elements
              </h3>
              <span className="chip-info font-mono">{fieldFiltered.layers.length}</span>
            </div>
            <ul className="space-y-1 p-2">
              {fieldFiltered.layers.map((l) => {
                const hidden = Boolean(config.layers[l.id]?.hidden);
                const isSel = l.id === selectedId;
                return (
                  <li
                    key={l.id}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-2 py-1 ${
                      isSel ? "border-indigo-200 bg-indigo-50" : "border-transparent hover:bg-slate-50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => !hidden && setSelectedId(l.id)}
                      disabled={hidden}
                      aria-current={l.id === selectedId}
                      className={`min-w-0 flex-1 truncate rounded py-1.5 text-left text-sm ${
                        hidden ? "text-slate-400 line-through" : isSel ? "font-semibold text-indigo-700" : "text-slate-700 hover:text-indigo-600"
                      }`}
                    >
                      {layerLabel(l.id)}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        toggleHidden(l.id, !hidden);
                        if (!hidden && selectedId === l.id) setSelectedId(null);
                      }}
                      aria-label={`${hidden ? "Show" : "Hide"} ${layerLabel(l.id)}`}
                      className="btn-secondary btn-sm shrink-0 !px-2 font-mono"
                    >
                      {hidden ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
                      {hidden ? "Show" : "Hide"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* centre: the card stage */}
          <div className="order-1 min-w-0 rounded-xl border border-slate-200 bg-slate-100 p-4 sm:p-6 lg:order-2">
            <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Preview role">
              <span className="eyebrow !text-slate-600">Preview as:</span>
              {loaded.roles.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  aria-pressed={r === role}
                  className={`rounded-full border px-3 py-1 text-sm font-medium capitalize transition ${
                    r === role ? "border-indigo-600 bg-indigo-600 text-white shadow-sm" : "border-slate-300 bg-white text-slate-700 hover:border-indigo-400"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="rounded-lg bg-slate-200/60 px-2 py-6 sm:py-8">
              <EditorCanvas
                template={effective}
                data={data}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onMove={(layerId, x, y, key) => changeLayer(layerId, { x, y }, key)}
              />
            </div>
            <p className="mt-3 text-center text-xs text-slate-500">
              The preview uses a sample person. Arrow keys move the selected element (Shift = bigger steps). Ctrl+Z undoes.
            </p>
          </div>

          {/* right: properties, role colours, refine */}
          <div className="order-3 space-y-4">
            {selected ? (
              <PropertiesPanel
                layer={selected}
                hasChanges={Boolean(config.layers[selected.id] && Object.keys(config.layers[selected.id]).length)}
                roleColor={roleColorOf(role)}
                onChange={changeLayer}
                onReset={resetLayer}
              />
            ) : (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-500">
                Nothing selected. Click an element on the card, or pick one from the list below.
              </p>
            )}

            <section aria-label="Role colours" className="card-pad !p-4">
              <h3 className="section-title">Role colours</h3>
              <p className="mt-1 text-xs text-slate-500">Each role gets its own colour on every card.</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {loaded.roles.map((r) => (
                  <ColorField key={r} label={r.charAt(0).toUpperCase() + r.slice(1)} value={roleColorOf(r)} onChange={(v) => setRoleColor(r, v)} />
                ))}
              </div>
            </section>

            <RefineBox
              projectId={id}
              draftId={loaded.draftId}
              config={config}
              selectedId={selectedId}
              onApply={(next) => commit(() => next)}
            />
          </div>
        </div>
      </div>
    </main>
  );
}