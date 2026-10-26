import { currentUser } from "@/lib/auth";
import { approveCreative } from "@/lib/creatives";

/** Lint, then freeze an immutable version with its fingerprint. Body: { row_version }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { row_version?: unknown } | null;
  if (typeof b?.row_version !== "number") return Response.json({ error: "missing_row_version" }, { status: 400 });
  const r = await approveCreative((await params).id, user.id, b.row_version);
  return "error" in r ? Response.json(r, { status: r.status }) : Response.json(r);
}
