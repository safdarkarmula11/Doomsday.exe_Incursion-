import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";
import { applyFields } from "@/lib/cardData";
import { normalizeConfig } from "@/lib/editorConfig";
import { refine } from "@/lib/refine";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/**
 * POST { instruction, config, selectedId? } -> { config, applied, ignored, source }
 * "config" is the editor's current (maybe unsaved) state; the answer is that state plus the requested changes.
 * Nothing is saved here: the editor applies it as one undo step and saves like any other edit.
 */
export async function POST(request, { params }) {
  const { id, draftId } = await params;
  const body = await request.json().catch(() => null);
  const instruction = typeof body?.instruction === "string" ? body.instruction.trim() : "";
  if (instruction.length < 3) return Response.json({ error: "Type what you want to change." }, { status: 400 });
  if (instruction.length > 300) return Response.json({ error: "Keep it under 300 characters." }, { status: 400 });

  try {
    const draft = await db.draft.findFirst({ where: { id: draftId, projectId: id }, include: { template: true } });
    if (!draft) return Response.json({ error: "Design not found." }, { status: 404 });
    const project = await db.project.findUnique({ where: { id } });
    const checked = validateEventData(project?.eventData);
    if (!checked.ok) return Response.json({ error: "Finish the event details first." }, { status: 409 });

    const result = await refine({
      instruction,
      template: applyFields(draft.template.json, checked.data.fieldsToShow),
      config: normalizeConfig(body?.config),
      roles: Object.keys(checked.data.roles),
      selectedId: typeof body?.selectedId === "string" ? body.selectedId : null,
    });
    return Response.json(result);
  } catch (e) {
    console.error("refine failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}