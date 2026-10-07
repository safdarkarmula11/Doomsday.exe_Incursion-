import { db } from "@/lib/db";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** PATCH -> choose this draft: it becomes the only selected one and the project moves on to the editor. */
export async function PATCH(_request, { params }) {
  const { id, draftId } = await params;
  try {
    const draft = await db.draft.findFirst({ where: { id: draftId, projectId: id } });
    if (!draft) return Response.json({ error: "Design not found." }, { status: 404 });

    await db.$transaction([
      db.draft.updateMany({ where: { projectId: id }, data: { selected: false } }),
      db.draft.update({ where: { id: draftId }, data: { selected: true } }),
      db.project.update({ where: { id }, data: { status: "editor" } }),
    ]);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("PATCH draft failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}