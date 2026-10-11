"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { FIELD_DEFS, MAX_FILE_BYTES, MAX_ROWS, SKIP, autoMap, buildRows } from "@/lib/people";

const BADGE = {
  ok: "bg-green-100 text-green-800",
  warning: "bg-amber-100 text-amber-800",
  error: "bg-red-100 text-red-800",
  skipped: "bg-slate-100 text-slate-600",
};
const BADGE_TEXT = { ok: "OK", warning: "Check", error: "Problem", skipped: "Skipped" };

/** Upload a CSV -> match columns -> fix roles -> import. Calls onDone(count) after a successful import. */
export default function CsvImporter({ projectId, roles, existingCount, onDone }) {
  const input = useRef(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [records, setRecords] = useState([]);
  const [mapping, setMapping] = useState({ name: "", role: "", id: "", photo: "" });
  const [roleMap, setRoleMap] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showAll, setShowAll] = useState(false);

  function reset() {
    setFileName("");
    setHeaders([]);
    setRecords([]);
    setRoleMap({});
    setError("");
    if (input.current) input.current.value = "";
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) return setError("That file is too big (limit 2 MB). Split it into smaller files.");
    if (!/\.(csv|txt)$/i.test(file.name)) return setError("Please choose a .csv file. In Excel: File, Save As, CSV.");

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => h.replace(/^﻿/, "").trim(),
      complete: (res) => {
        const fields = (res.meta.fields ?? []).filter(Boolean);
        if (fields.length === 0 || res.data.length === 0) return setError("That file has no rows. The first line must be the column names.");
        if (res.data.length > MAX_ROWS) return setError(`That file has ${res.data.length} rows. The limit is ${MAX_ROWS} at a time.`);
        setFileName(file.name);
        setHeaders(fields);
        setRecords(res.data);
        setMapping(autoMap(fields));
        setRoleMap({});
        setShowAll(false);
      },
      error: () => setError("Could not read that file."),
    });
  }

  const ready = Boolean(mapping.name && mapping.role);
  const built = useMemo(
    () => (ready ? buildRows({ records, mapping, roles, roleMap }) : null),
    [ready, records, mapping, roles, roleMap]
  );
  const importable = built ? built.rows.filter((r) => r.status === "ok" || r.status === "warning") : [];

  async function doImport() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/projects/${projectId}/people`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace: true,
          people: importable.map((r) => ({ name: r.name, role: r.role, externalId: r.externalId, photoUrl: r.photoUrl, extra: r.extra })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not save the people. Please try again.");
      reset();
      onDone(data.imported);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const select = "w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm";

  return (
    <div>
      {!records.length && (
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm text-slate-700">Choose a CSV file with one person per row.</p>
          <p className="mt-1 text-xs text-slate-500">
            Needs a name and a role column. ID number and photo link are optional.{" "}
            <a href="/sample-people.csv" download className="font-medium text-indigo-600 underline">
              Download an example file
            </a>
          </p>
          <label className="mt-4 inline-block cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
            Choose a CSV file
            <input ref={input} type="file" accept=".csv,.txt,text/csv" onChange={onFile} className="sr-only" />
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {records.length > 0 && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-4 py-3 text-sm ring-1 ring-slate-200">
            <span>
              <strong>{fileName}</strong>: {records.length} rows
            </span>
            <button type="button" onClick={reset} className="text-xs font-medium text-indigo-600 underline">
              Choose a different file
            </button>
          </div>

          <section aria-label="Match the columns" className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-semibold">1. Match the columns</h3>
            <p className="mt-1 text-xs text-slate-500">We guessed. Change any that are wrong.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {FIELD_DEFS.map((f) => (
                <label key={f.key} className="block text-sm">
                  <span className="block text-xs font-medium text-slate-600">
                    {f.label} {f.required ? <span className="text-red-600">(required)</span> : <span className="text-slate-400">(optional)</span>}
                  </span>
                  <select
                    value={mapping[f.key]}
                    onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    className={`mt-1 ${select}`}
                  >
                    <option value="">{f.required ? "Choose a column..." : "(none)"}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {!ready && <p className="mt-3 text-sm text-amber-700">Choose which column holds the name and which holds the role.</p>}
          </section>

          {built && built.unknownRoles.length > 0 && (
            <section aria-label="Unknown roles" className="rounded-xl border border-amber-300 bg-amber-50 p-4">
              <h3 className="font-semibold text-amber-900">2. Some roles are not in this event</h3>
              <p className="mt-1 text-xs text-amber-800">
                This event has: {roles.join(", ")}. Say what to do with the others.
              </p>
              <div className="mt-3 space-y-2">
                {built.unknownRoles.map((u) => (
                  <label key={u.role} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="min-w-40">
                      "{u.role}" <span className="text-xs text-slate-500">({u.count} {u.count === 1 ? "row" : "rows"})</span>
                    </span>
                    <select
                      value={roleMap[u.role] ?? ""}
                      onChange={(e) => setRoleMap((m) => ({ ...m, [u.role]: e.target.value }))}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                      aria-label={`What to do with role ${u.role}`}
                    >
                      <option value="">Choose...</option>
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          Use "{r}"
                        </option>
                      ))}
                      <option value={SKIP}>Skip these people</option>
                    </select>
                  </label>
                ))}
              </div>
            </section>
          )}

          {built && (
            <section aria-label="Check the rows" className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-semibold">{built.unknownRoles.length > 0 ? "3." : "2."} Check the rows</h3>
              <div role="status" className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE.ok}`}>{built.summary.ok} fine</span>
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE.warning}`}>{built.summary.warning} to check</span>
                <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE.error}`}>{built.summary.error} with problems</span>
                {built.summary.skipped > 0 && (
                  <span className={`rounded-full px-2.5 py-0.5 font-medium ${BADGE.skipped}`}>{built.summary.skipped} skipped</span>
                )}
              </div>
              {built.summary.error > 0 && <p className="mt-2 text-xs text-slate-500">Rows with problems are left out. Fix them in your file and upload it again, or import without them.</p>}
              {!mapping.id && <p className="mt-2 text-xs text-slate-500">No ID column chosen, so cards will have no ID number and no QR code.</p>}

              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs uppercase text-slate-500">
                    <tr>
                      <th className="py-1 pr-3">Line</th>
                      <th className="py-1 pr-3">Name</th>
                      <th className="py-1 pr-3">Role</th>
                      <th className="py-1 pr-3">ID</th>
                      <th className="py-1">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(showAll ? built.rows : built.rows.slice(0, 25)).map((r) => (
                      <tr key={r.line} className="align-top">
                        <td className="py-1.5 pr-3 text-slate-400">{r.line}</td>
                        <td className="py-1.5 pr-3">{r.name || <em className="text-slate-400">empty</em>}</td>
                        <td className="py-1.5 pr-3 capitalize">{r.role || <em className="text-slate-400">?</em>}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{r.externalId}</td>
                        <td className="py-1.5">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[r.status]}`}>{BADGE_TEXT[r.status]}</span>
                          {r.issues.map((x) => (
                            <span key={x.message} className={`mt-0.5 block text-xs ${x.level === "error" ? "text-red-600" : "text-amber-700"}`}>
                              {x.message}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {built.rows.length > 25 && (
                <button type="button" onClick={() => setShowAll((s) => !s)} className="mt-2 text-xs font-medium text-indigo-600 underline">
                  {showAll ? "Show fewer rows" : `Show all ${built.rows.length} rows`}
                </button>
              )}
            </section>
          )}

          {built && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                {importable.length} {importable.length === 1 ? "person" : "people"} will be added
                {existingCount > 0 ? `, replacing the ${existingCount} you have now` : ""}.
              </p>
              <button
                type="button"
                onClick={doImport}
                disabled={busy || importable.length === 0}
                className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {busy ? "Saving..." : `Import ${importable.length} ${importable.length === 1 ? "person" : "people"}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}