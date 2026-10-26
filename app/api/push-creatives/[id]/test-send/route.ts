import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { testSend } from "@/lib/push/test-send";

/** Guarded staff test send: exact PUSH_TEST_SEND_USER_KEYS canary, pinned approved version, [TEST] prefix, separate ledger. Body: { firebaseUid, versionId? }. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const { id } = await params;
  const b = (await req.json().catch(() => null)) as { firebaseUid?: unknown; versionId?: unknown } | null;
  if (typeof b?.firebaseUid !== "string" || b.firebaseUid.length < 1 || b.firebaseUid.length > 128) return Response.json({ error: "bad_firebase_uid" }, { status: 400 });
  let versionId = typeof b.versionId === "string" ? b.versionId : null;
  if (!versionId) { const { data } = await db().from("push_creative_version").select("id").eq("creative_id", id).order("version", { ascending: false }).limit(1).maybeSingle(); versionId = data?.id ?? null; }
  if (!versionId) return Response.json({ error: "no_approved_version" }, { status: 409 });
  const r = await testSend(user.id, b.firebaseUid, versionId);
  return "status" in r && typeof r.status === "number" ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r);
}
