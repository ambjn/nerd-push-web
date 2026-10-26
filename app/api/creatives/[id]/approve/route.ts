import { requireRole } from "@/lib/control/auth";
import { getCreative } from "@/lib/control/creatives";
import { controlDb } from "@/lib/control/db";
import { fingerprint, lintCreative } from "@/lib/push/creative";

/** Sender role. Lints the current draft, then freezes an immutable version in one DB transaction. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = await requireRole("sender");
  if (op instanceof Response) return op;
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as { row_version?: unknown } | null;
  if (typeof body?.row_version !== "number") return Response.json({ error: "missing_row_version" }, { status: 400 });
  const creative = await getCreative(id);
  if (!creative) return Response.json({ error: "not_found" }, { status: 404 });
  const lint = lintCreative(creative);
  if (lint.length) return Response.json({ error: "lint_failed", lint }, { status: 422 });
  const { data, error } = await controlDb().rpc("approve_creative", {
    p_creative_id: id, p_actor: op.userId, p_expected_row_version: body.row_version, p_sha256: fingerprint(creative),
  });
  if (error) {
    const code = error.message.includes("stale") || error.message.includes("fingerprint") ? 409 : error.message.includes("not_draft") ? 409 : 500;
    return Response.json({ error: error.message.split("\n")[0] }, { status: code });
  }
  return Response.json({ versionId: data as string });
}
