import { db } from "@/lib/db";
import { parseRequest } from "@/lib/parseRequest";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

/** POST { request: "We are hosting..." } -> reads the request, creates the project. */
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const text = typeof body?.request === "string" ? body.request.trim() : "";
  if (text.length < 10) {
    return Response.json({ error: "Describe your event in a sentence or two." }, { status: 400 });
  }
  if (text.length > 2000) {
    return Response.json({ error: "That is too long. Keep it under 2000 characters." }, { status: 400 });
  }

  // Never throws: falls back to the rule-based parser if the LLM is unavailable.
  const parsed = await parseRequest(text);

  const eventData = {
    ...parsed.extracted,
    _meta: { request: text, confirm: parsed.confirm, missing: parsed.missing, source: parsed.source },
  };

  try {
    const project = await db.project.create({
      data: {
        name: parsed.extracted.eventName || "Untitled project",
        designType: "id_card",
        eventData,
        status: "questions",
      },
    });
    return Response.json({ id: project.id, source: parsed.source }, { status: 201 });
  } catch (e) {
    console.error("POST /api/projects failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** GET -> list of projects, newest first. */
export async function GET() {
  try {
    const projects = await db.project.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, status: true, updatedAt: true },
    });
    return Response.json({ projects });
  } catch (e) {
    console.error("GET /api/projects failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}