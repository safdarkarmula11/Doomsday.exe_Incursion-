/** Server only: finding the brand kit of a project. */
import { db } from "@/lib/db";
import { DEFAULT_KIT, parseKit } from "@/lib/brand";

/** The default kit row. Created the first time it is needed (like the built-in templates). */
export async function ensureDefaultKit() {
  const found = await db.brandKit.findFirst({ where: { isDefault: true } });
  if (found) return found;
  return db.brandKit.create({
    data: { name: DEFAULT_KIT.name, logos: DEFAULT_KIT.logos, colors: {}, fonts: DEFAULT_KIT.fonts, roleColors: DEFAULT_KIT.roleColors, isDefault: true },
  });
}

/** The kit this project uses: the one chosen for it, else the default kit. Always returns a usable kit. */
export async function kitForProject(project) {
  let row = null;
  if (project?.brandKitId) row = await db.brandKit.findUnique({ where: { id: project.brandKitId } });
  if (!row) row = await ensureDefaultKit();
  return parseKit(row);
}