import { requireRole } from "@/lib/control/auth";
import { getCreative, parseCreativeInput, patchCreative } from "@/lib/control/creatives";
import { controlDb } from "@/lib/control/db";
import { lintCreative } from "@/lib/push/creative";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  const { id } = await params;
  const creative = await getCreative(id);
  if (!creative) return Response.json({ error: "not_found" }, { status: 404 });
  const { data: versions } = await controlDb().from("push_creative_version").select("*").eq("creative_id", id).order("version", { ascending: false });
  return Response.json({ creative, lint: lintCreative(creative), versions: versions ?? [] });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { row_version?: unknown; patch?: unknown } | null;
  if (typeof body?.row_version !== "number") return Response.json({ error: "missing_row_version" }, { status: 400 });
  const patch = parseCreativeInput(body.patch, true);
  if ("error" in patch) return Response.json(patch, { status: 400 });
  const result = await patchCreative(id, body.row_version, patch);
  if (!result) return Response.json({ error: "stale_or_not_draft" }, { status: 409 });
  return Response.json(result);
}
