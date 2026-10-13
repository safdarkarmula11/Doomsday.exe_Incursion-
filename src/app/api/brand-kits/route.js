import { db } from "@/lib/db";
import { BrandKitSchema, parseKit } from "@/lib/brand";
import { ensureDefaultKit } from "@/lib/brandKits";

const DB_ERROR = "Could not reach the database. Check that PostgreSQL is running and DATABASE_URL in .env is correct.";

export const dynamic = "force-dynamic";

/** GET -> every brand kit, with how many events use it. */
export async function GET() {
  try {
    await ensureDefaultKit();
    const rows = await db.brandKit.findMany({ orderBy: { createdAt: "asc" } });
    const kits = [];
    for (const row of rows) {
      const usedBy = await db.project.count({ where: { brandKitId: row.id } });
      kits.push({ ...parseKit(row), usedBy });
    }
    return Response.json({ kits });
  } catch (e) {
    console.error("GET brand kits failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}

/** POST { name, logos, roleColors, fonts } -> a new brand kit. */
export async function POST(request) {
  const body = await request.json().catch(() => null);
  const parsed = BrandKitSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message || "Those details are not valid." }, { status: 422 });
  }
  try {
    const k = parsed.data;
    const row = await db.brandKit.create({ data: { name: k.name, logos: k.logos, colors: {}, fonts: k.fonts, roleColors: k.roleColors, isDefault: false } });
    return Response.json({ kit: { ...parseKit(row), usedBy: 0 } }, { status: 201 });
  } catch (e) {
    console.error("POST brand kit failed:", e);
    return Response.json({ error: DB_ERROR }, { status: 500 });
  }
}