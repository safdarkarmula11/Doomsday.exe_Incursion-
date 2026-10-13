import { db } from "@/lib/db";
import { BrandKitSchema, parseKit } from "@/lib/brand";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** PUT { name, logos, roleColors, fonts } -> saves the changes to a brand kit. */
export async function PUT(request, { params }) {
  const { kitId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = BrandKitSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Those details are not valid." }, { status: 422 });
  }
  try {
    const existing = await db.brandKit.findUnique({ where: { id: kitId } });
    if (!existing) return Response.json({ error: "Brand kit not found." }, { status: 404 });
    const k = parsed.data;
    const row = await db.brandKit.update({ where: { id: kitId }, data: { name: k.name, logos: k.logos, fonts: k.fonts, roleColors: k.roleColors } });
    return Response.json({ kit: parseKit(row) });
  } catch (e) {
    console.error("PUT brand kit failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** DELETE -> removes a brand kit. The default kit stays. Events that used it go back to the default. */
export async function DELETE(_request, { params }) {
  const { kitId } = await params;
  try {
    const existing = await db.brandKit.findUnique({ where: { id: kitId } });
    if (!existing) return Response.json({ error: "Brand kit not found." }, { status: 404 });
    if (existing.isDefault) return Response.json({ error: "The default brand kit cannot be deleted." }, { status: 403 });
    await db.project.updateMany({ where: { brandKitId: kitId }, data: { brandKitId: null } });
    await db.brandKit.deleteMany({ where: { id: kitId } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE brand kit failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}