import { db } from "@/lib/db";
import { validateEventData } from "@/lib/eventData";
import { ensureTemplates, renderDraft } from "@/lib/drafts";

/** Renderer warnings -> short sentences. The sample person has no photo on purpose, so that one is skipped. */
function describe(w) {
  if (w.kind === "overflow") return `Text in "${w.layerId}" was shortened to fit.`;
  if (w.kind === "missing") return `Nothing to show for "${w.field}".`;
  return `"${w.layerId}" cannot be drawn yet.`;
}

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

async function loadProject(id) {
  const project = await db.project.findUnique({ where: { id } });
  if (!project) return { error: Response.json({ error: "Project not found." }, { status: 404 }) };
  const checked = validateEventData(project.eventData);
  if (!checked.ok) {
    return { error: Response.json({ error: "Finish the event details first.", needsDetails: true }, { status: 409 }) };
  }
  return { project, eventData: checked.data };
}

/** GET ?role=mentor -> the drafts of this project, each rendered with a sample person of that role. */
export async function GET(request, { params }) {
  const { id } = await params;
  try {
    const loaded = await loadProject(id);
    if (loaded.error) return loaded.error;
    const { eventData } = loaded;

    const roles = Object.keys(eventData.roles);
    const wanted = new URL(request.url).searchParams.get("role");
    const role = roles.includes(wanted) ? wanted : roles[0];

    const drafts = await db.draft.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "asc" },
      include: { template: true },
    });

    const out = [];
    for (const d of drafts) {
      const { svg, warnings } = renderDraft(d, d.template, eventData, role);
      out.push({
        id: d.id,
        name: d.template.name,
        selected: d.selected,
        svg,
        warnings: warnings.filter((w) => w.field !== "photo").map((w) => ({ message: describe(w) })),
      });
    }
    return Response.json({ drafts: out, roles, role });
  } catch (e) {
    console.error("GET drafts failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** POST { regenerate?: true } -> creates one draft per template. Does nothing if drafts exist, unless regenerate. */
export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  try {
    const loaded = await loadProject(id);
    if (loaded.error) return loaded.error;

    const existing = await db.draft.count({ where: { projectId: id } });
    if (existing > 0 && !body?.regenerate) return Response.json({ created: 0 });

    const templates = await ensureTemplates();
    const version = existing > 0 ? (await db.draft.findFirst({ where: { projectId: id }, orderBy: { version: "desc" } })).version + 1 : 1;

    if (existing > 0) await db.draft.deleteMany({ where: { projectId: id } });
    await db.draft.createMany({
      data: Object.values(templates).map((t) => ({ projectId: id, templateId: t.id, config: {}, version })),
    });
    return Response.json({ created: Object.keys(templates).length }, { status: 201 });
  } catch (e) {
    console.error("POST drafts failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}