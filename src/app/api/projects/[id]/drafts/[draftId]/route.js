import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";
import { EditorConfigSchema, normalizeConfig } from "@/lib/editorConfig";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** GET -> everything the editor needs: the template, the user's saved changes, the event details. */
export async function GET(_request, { params }) {
  const { id, draftId } = await params;
  try {
    const draft = await db.draft.findFirst({ where: { id: draftId, projectId: id }, include: { template: true } });
    if (!draft) return Response.json({ error: "Design not found." }, { status: 404 });
    const project = await db.project.findUnique({ where: { id } });
    const checked = validateEventData(project?.eventData);
    if (!checked.ok) {
      return Response.json({ error: "Finish the event details first.", needsDetails: true }, { status: 409 });
    }
    return Response.json({
      draft: { id: draft.id, name: draft.template.name, selected: draft.selected },
      template: draft.template.json,
      config: normalizeConfig(draft.config),
      eventData: checked.data,
      roles: Object.keys(checked.data.roles),
    });
  } catch (e) {
    console.error("GET draft failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** PUT { config } -> saves the editor changes. */
export async function PUT(request, { params }) {
  const { id, draftId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = EditorConfigSchema.safeParse(body?.config);
  if (!parsed.success) return Response.json({ error: "Those changes could not be saved (invalid values)." }, { status: 422 });
  try {
    const draft = await db.draft.findFirst({ where: { id: draftId, projectId: id } });
    if (!draft) return Response.json({ error: "Design not found." }, { status: 404 });
    await db.draft.update({ where: { id: draftId }, data: { config: parsed.data } });
    return Response.json({ ok: true });
  } catch (e) {
    console.error("PUT draft failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

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