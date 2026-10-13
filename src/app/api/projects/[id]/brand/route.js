import { db } from "@/lib/db";
import { ensureDefaultKit } from "@/lib/brandKits";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

export const dynamic = "force-dynamic";

/** GET -> which brand kit this event uses, and the kits it can switch to. */
export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const def = await ensureDefaultKit();
    const rows = await db.brandKit.findMany({ orderBy: { createdAt: "asc" } });
    const current = rows.some((r) => r.id === project.brandKitId) ? project.brandKitId : def.id;
    return Response.json({ kitId: current, kits: rows.map((r) => ({ id: r.id, name: r.name, isDefault: r.isDefault })) });
  } catch (e) {
    console.error("GET project brand failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** PUT { brandKitId } -> this event now uses that brand kit. */
export async function PUT(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (typeof body?.brandKitId !== "string") return Response.json({ error: "Choose a brand kit." }, { status: 422 });
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    const kit = await db.brandKit.findUnique({ where: { id: body.brandKitId } });
    if (!kit) return Response.json({ error: "That brand kit no longer exists." }, { status: 404 });
    await db.project.update({ where: { id }, data: { brandKitId: kit.id } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("PUT project brand failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}