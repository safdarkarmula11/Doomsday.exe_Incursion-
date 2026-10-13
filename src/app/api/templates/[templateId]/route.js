import { db } from "@/lib/db";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** DELETE -> removes a template you added. Built-in ones, and ones that events still use, stay. */
export async function DELETE(_request, { params }) {
  const { templateId } = await params;
  try {
    const row = await db.template.findUnique({ where: { id: templateId } });
    if (!row) return Response.json({ error: "Template not found." }, { status: 404 });
    if (row.isDefault) return Response.json({ error: "Built-in templates cannot be deleted." }, { status: 403 });
    const used = await db.draft.count({ where: { templateId } });
    if (used > 0) return Response.json({ error: `${used} ${used === 1 ? "design uses" : "designs use"} this template, so it cannot be deleted.` }, { status: 409 });
    await db.template.deleteMany({ where: { id: templateId } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("DELETE template failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}