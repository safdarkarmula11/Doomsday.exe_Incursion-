// Render pings this to know the app is up. It does not touch the database on purpose.
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ ok: true });
}