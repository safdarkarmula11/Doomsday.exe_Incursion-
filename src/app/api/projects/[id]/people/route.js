import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";
import { validateImport } from "@/lib/people";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";
const CHUNK = 500;

/** GET ?offset=0&limit=50 -> { total, byRole, people } */
export async function GET(request, { params }) {
  const { id } = await params;
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });

    const [total, groups, people] = await Promise.all([
      db.person.count({ where: { projectId: id } }),
      db.person.groupBy({ by: ["role"], where: { projectId: id }, _count: { _all: true } }),
      db.person.findMany({ where: { projectId: id }, orderBy: { id: "asc" }, skip: offset, take: limit }),
    ]);
    const byRole = Object.fromEntries(groups.map((g) => [g.role, g._count._all]));
    return Response.json({ total, byRole, people });
  } catch (e) {
    console.error("GET people failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** POST { people: [...], replace: true } -> saves them (checked again here, never trust the browser). */
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const event = validateEventData(project.eventData);
    if (!event.ok) return Response.json({ error: "Finish the event details first.", needsDetails: true }, { status: 409 });

    const checked = validateImport(body, Object.keys(event.data.roles));
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 422 });

    const rows = checked.people.map((p) => ({
      projectId: id,
      name: p.name,
      role: p.role,
      externalId: p.externalId || null,
      photoUrl: p.photoUrl || null,
      extra: p.extra,
    }));
    const ops = [];
    if (checked.replace) ops.push(db.person.deleteMany({ where: { projectId: id } }));
    for (let i = 0; i < rows.length; i += CHUNK) ops.push(db.person.createMany({ data: rows.slice(i, i + CHUNK) }));
    await db.$transaction(ops);
    return Response.json({ imported: rows.length }, { status: 201 });
  } catch (e) {
    console.error("POST people failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** DELETE -> removes everyone from this project. */
export async function DELETE(_request, { params }) {
  const { id } = await params;
  try {
    const { count } = await db.person.deleteMany({ where: { projectId: id } });
    return Response.json({ deleted: count });
  } catch (e) {
    console.error("DELETE people failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}