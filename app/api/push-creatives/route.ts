import { currentUser } from "@/lib/auth";
import { createCreative, listCreatives, parseInput, patchCreative } from "@/lib/creatives";

export async function GET() {
  if (!(await currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(await listCreatives());
}
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const input = parseInput(await req.json().catch(() => null));
  if ("error" in input) return Response.json(input, { status: 400 });
  return Response.json(await createCreative(user.id, input), { status: 201 });
}
/** Draft edit with row-version compare-and-swap: { id, row_version, patch }. */
export async function PATCH(req: Request) {
  if (!(await currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { id?: unknown; row_version?: unknown; patch?: unknown } | null;
  if (typeof b?.id !== "string" || typeof b.row_version !== "number") return Response.json({ error: "missing_id_or_row_version" }, { status: 400 });
  const patch = parseInput(b.patch, true);
  if ("error" in patch) return Response.json(patch, { status: 400 });
  const r = await patchCreative(b.id, b.row_version, patch).catch((e: Error) => ({ error: e.message }));
  if (!r) return Response.json({ error: "stale_or_not_draft" }, { status: 409 });
  return "error" in r ? Response.json(r, { status: 409 }) : Response.json(r);
}
