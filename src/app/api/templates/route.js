import { db } from "@/lib/db";
import { renderCard } from "@/lib/renderer/renderCard";
import { ensureTemplates } from "@/lib/drafts";
import { ensureDefaultKit } from "@/lib/brandKits";
import { applyBrand, parseKit } from "@/lib/brand";
import { applyConfig } from "@/lib/editorConfig";
import { cardData, samplePerson } from "@/lib/cardData";
import { validateTemplate } from "@/lib/templateSchema";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

export const dynamic = "force-dynamic";

const SAMPLE_EVENT = { eventName: "Event name", tagline: "Your tagline", date: "1 January 2027", venue: "Venue", qrBaseUrl: "https://example.com/checkin" };

function preview(json, kit, index) {
  const role = Object.keys(json.roleColors ?? {})[0] ?? "participant";
  const { svg } = renderCard(applyBrand(json, kit), cardData(SAMPLE_EVENT, samplePerson(role)));
  return svg.replace(/id="clip-/g, `id="t${index}_clip-`).replace(/url\(#clip-/g, `url(#t${index}_clip-`);
}

function slugify(name) {
  return String(name).normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").toLowerCase().slice(0, 28) || "template";
}

/** GET -> every template, with a preview picture, the JSON, and how many designs use it. */
export async function GET(request) {
  try {
    await ensureTemplates();
    if (new URL(request.url).searchParams.get("brief") === "1") {
      const all = await db.template.findMany({ orderBy: { createdAt: "asc" } });
      return Response.json({ templates: all.map((r) => ({ id: r.id, name: r.name, builtIn: Boolean(r.isDefault) })) });
    }
    const kit = parseKit(await ensureDefaultKit());
    const rows = await db.template.findMany({ orderBy: { createdAt: "asc" } });
    const templates = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      templates.push({
        id: row.id,
        name: row.name,
        builtIn: Boolean(row.isDefault),
        usedBy: await db.draft.count({ where: { templateId: row.id } }),
        json: row.json,
        svg: preview(row.json, kit, i),
      });
    }
    return Response.json({ templates });
  } catch (e) {
    console.error("GET templates failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/**
 * POST { name, json }          -> adds a template from a JSON file
 * POST { name, fromDraftId }   -> saves a design from the editor (with its changes) as a new template
 */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return Response.json({ error: "Give the template a name." }, { status: 422 });

  try {
    let source = body?.json;
    if (body?.fromDraftId) {
      const draft = await db.draft.findFirst({ where: { id: String(body.fromDraftId) }, include: { template: true } });
      if (!draft) return Response.json({ error: "That design was not found." }, { status: 404 });
      source = applyConfig(draft.template.json, draft.config);
    }
    if (!source || typeof source !== "object") return Response.json({ error: "Add a template file (JSON)." }, { status: 422 });

    // The id is ours (so two uploads can never clash); the layout is theirs.
    let slug = "";
    for (let tries = 0; tries < 5; tries++) {
      const candidate = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
      if (!(await db.template.findUnique({ where: { slug: candidate } }))) {
        slug = candidate;
        break;
      }
    }
    if (!slug) return Response.json({ error: "Try a different name." }, { status: 409 });

    const checked = validateTemplate({ ...source, id: slug, name });
    if (!checked.ok) return Response.json({ error: "This template has problems.", problems: checked.errors }, { status: 422 });

    const row = await db.template.create({ data: { slug, name, designType: "id_card", json: checked.data, isDefault: false } });
    return Response.json({ template: { id: row.id, name: row.name } }, { status: 201 });
  } catch (e) {
    console.error("POST template failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}