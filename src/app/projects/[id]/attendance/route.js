import { db } from "@/lib/db";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL is correct.";

const csvCell = (v) => {
  const s = String(v ?? "");
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // stop spreadsheet formulas
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** GET -> everyone with their check-in time. ?format=csv downloads it. */
export async function GET(request, { params }) {
  const { id } = await params;
  const format = new URL(request.url).searchParams.get("format");
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

    const [people, scans] = await Promise.all([
      db.person.findMany({ where: { projectId: id }, orderBy: { id: "asc" } }),
      db.attendance.findMany({ where: { projectId: id } }),
    ]);
    const at = new Map(scans.map((s) => [s.externalId, s.scannedAt]));
    const rows = people.map((p) => ({
      name: p.name,
      role: p.role,
      externalId: p.externalId ?? "",
      checkedInAt: p.externalId && at.has(p.externalId) ? new Date(at.get(p.externalId)).toISOString() : null,
    }));

    if (format === "csv") {
      const lines = ["Name,Role,ID Number,Checked in,Checked in at"];
      for (const r of rows) lines.push([r.name, r.role, r.externalId, r.checkedInAt ? "yes" : "no", r.checkedInAt ?? ""].map(csvCell).join(","));
      const file = (project.name || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
      return new Response(lines.join("\n") + "\n", {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${file}-attendance.csv"` },
      });
    }

    const byRole = {};
    for (const r of rows) {
      byRole[r.role] ??= { total: 0, checkedIn: 0 };
      byRole[r.role].total += 1;
      if (r.checkedInAt) byRole[r.role].checkedIn += 1;
    }
    return Response.json({
      project: { id: project.id, name: project.name },
      total: rows.length,
      checkedIn: rows.filter((r) => r.checkedInAt).length,
      byRole,
      people: rows,
    });
  } catch (e) {
    console.error("GET attendance failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** POST { externalId } -> marks that person as arrived. Safe to repeat: the first time is kept. */
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const externalId = String(body?.externalId ?? "").trim();
  if (!externalId) return Response.json({ error: "No ID was given." }, { status: 400 });
  try {
    const person = await db.person.findFirst({ where: { projectId: id, externalId } });
    if (!person) return Response.json({ error: `No one with ID "${externalId}" is in this project.` }, { status: 404 });

    const shown = { name: person.name, role: person.role, externalId };
    const existing = await db.attendance.findFirst({ where: { projectId: id, externalId } });
    if (existing) return Response.json({ person: shown, checkedInAt: existing.scannedAt, already: true });

    try {
      const row = await db.attendance.create({ data: { projectId: id, externalId, name: person.name, role: person.role } });
      return Response.json({ person: shown, checkedInAt: row.scannedAt, already: false }, { status: 201 });
    } catch (e) {
      if (e?.code !== "P2002") throw e; // two scans at once: the other one won
      const again = await db.attendance.findFirst({ where: { projectId: id, externalId } });
      return Response.json({ person: shown, checkedInAt: again?.scannedAt ?? new Date(), already: true });
    }
  } catch (e) {
    console.error("POST attendance failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** DELETE ?externalId=... -> undo a check-in. */
export async function DELETE(request, { params }) {
  const { id } = await params;
  const externalId = String(new URL(request.url).searchParams.get("externalId") ?? "").trim();
  if (!externalId) return Response.json({ error: "No ID was given." }, { status: 400 });
  try {
    await db.attendance.deleteMany({ where: { projectId: id, externalId } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE attendance failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}