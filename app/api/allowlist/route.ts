import { requireRole } from "@/lib/control/auth";
import { audit, controlDb } from "@/lib/control/db";
import { listAllowlist } from "@/lib/control/sends";

export async function GET() {
  const op = await requireRole("sender");
  if (op instanceof Response) return op;
  return Response.json(await listAllowlist());
}

/** Admin only. Exact UID, no wildcard (also enforced by a DB check). */
export async function POST(req: Request) {
  const op = await requireRole("admin");
  if (op instanceof Response) return op;
  const b = (await req.json().catch(() => null)) as { firebaseUid?: unknown; reason?: unknown; enabled?: unknown } | null;
  if (typeof b?.firebaseUid !== "string" || b.firebaseUid.length < 1 || b.firebaseUid.length > 128 || /[*%]/.test(b.firebaseUid)) return Response.json({ error: "bad_firebase_uid" }, { status: 400 });
  if (typeof b.reason !== "string" || b.reason.length < 1 || b.reason.length > 200) return Response.json({ error: "bad_reason" }, { status: 400 });
  const enabled = b.enabled !== false;
  const { error } = await controlDb().from("push_allowlist").upsert({ firebase_uid: b.firebaseUid, reason: b.reason, enabled, added_by: op.userId, added_at: new Date().toISOString() });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  await audit(op.userId, enabled ? "allowlist.enable" : "allowlist.disable", `allowlist:${b.firebaseUid}`, { reason: b.reason });
  return Response.json({ ok: true });
}
