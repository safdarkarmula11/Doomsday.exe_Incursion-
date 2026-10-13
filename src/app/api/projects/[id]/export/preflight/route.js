import { db } from "@/lib/db";
import { loadExportContext } from "@/lib/export/cards";
import { runPreflight } from "@/lib/export/preflight";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** GET -> { checked, items } : what to fix before printing (see src/lib/export/preflight.js). */
export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const ctx = await loadExportContext(id);
    if (ctx.error) return Response.json({ error: ctx.error }, { status: ctx.status });
    const people = await db.person.findMany({ where: { projectId: id }, orderBy: { id: "asc" } });
    return Response.json(runPreflight({ design: ctx.design, eventData: ctx.eventData, people }));
  } catch (e) {
    console.error("Pre-flight failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}