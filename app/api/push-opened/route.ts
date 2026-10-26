import { verifyFirebaseUid } from "@/lib/firebase";
import { controlDb } from "@/lib/control/db";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Android tap report. Firebase ID token; the send must belong to that UID; event IDs dedupe. */
export async function POST(req: Request) {
  const uid = await verifyFirebaseUid(req.headers.get("authorization"));
  if (!uid) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { sendId?: unknown; eventId?: unknown; openedAt?: unknown } | null;
  if (typeof b?.sendId !== "string" || !UUID.test(b.sendId) || typeof b.eventId !== "string" || !UUID.test(b.eventId)) return Response.json({ error: "bad_request" }, { status: 400 });
  const openedAt = typeof b.openedAt === "string" && !Number.isNaN(Date.parse(b.openedAt)) ? new Date(b.openedAt).toISOString() : new Date().toISOString();
  const { data, error } = await controlDb().rpc("record_push_tap", { p_send_id: b.sendId, p_firebase_uid: uid, p_event_id: b.eventId, p_opened_at: openedAt });
  if (error) return Response.json({ error: error.message.includes("send_not_owned") ? "forbidden" : "failed" }, { status: error.message.includes("send_not_owned") ? 403 : 500 });
  return Response.json({ recorded: data === true, duplicate: data !== true });
}
