import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** GET -> one project. */
export async function GET(_request, { params }) {
  const { id } = await params;
  try {
    const project = await db.project.findUnique({ where: { id } });
    if (!project) return Response.json({ error: "Project not found." }, { status: 404 });
    return Response.json({ project });
  } catch (e) {
    console.error("GET /api/projects/[id] failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** PATCH { eventData } -> validates the answers from the questions form and saves them. */
export async function PATCH(request, { params }) {
  const { id } = await params;

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const result = validateEventData(body?.eventData);
  if (!result.ok) {
    return Response.json({ error: "Please fix the highlighted fields.", fields: result.errors }, { status: 422 });
  }

  try {
    const existing = await db.project.findUnique({ where: { id } });
    if (!existing) return Response.json({ error: "Project not found." }, { status: 404 });

    // keep the _meta written when the project was created (original request, what was missing)
    const eventData = { ...result.data, _meta: existing.eventData?._meta ?? {} };
    const project = await db.project.update({
      where: { id },
      data: { eventData, name: result.data.eventName, status: "drafts" },
    });
    return Response.json({ project });
  } catch (e) {
    console.error("PATCH /api/projects/[id] failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}