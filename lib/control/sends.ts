import { controlDb } from "./db";

export type Send = {
  id: string; firebase_uid: string; creative_version_id: string; idempotency_key: string;
  status: "pending" | "sending" | "accepted" | "skipped" | "failed" | "delivery_unknown";
  scheduled_at: string; next_attempt_at: string; rendered_snapshot: unknown; claim_owner: string | null;
  reserved_at: string | null; provider_attempted_at: string | null; provider_accepted_at: string | null;
  error_code: string | null; retry_count: number; requested_by: string; requested_at: string; finished_at: string | null;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseEnqueueBody(x: unknown): { firebaseUid: string; creativeVersionId: string; idempotencyKey: string; scheduledAt: string | null } | { error: string } {
  if (!x || typeof x !== "object") return { error: "bad_json" };
  const b = x as Record<string, unknown>;
  if (typeof b.firebaseUid !== "string" || b.firebaseUid.length < 1 || b.firebaseUid.length > 128) return { error: "bad_firebase_uid" };
  if (typeof b.creativeVersionId !== "string" || !UUID.test(b.creativeVersionId)) return { error: "bad_creative_version_id" };
  if (typeof b.idempotencyKey !== "string" || b.idempotencyKey.length < 8 || b.idempotencyKey.length > 128) return { error: "bad_idempotency_key" };
  let scheduledAt: string | null = null;
  if (b.scheduledAt !== undefined && b.scheduledAt !== null) {
    if (typeof b.scheduledAt !== "string" || Number.isNaN(Date.parse(b.scheduledAt))) return { error: "bad_scheduled_at" };
    scheduledAt = new Date(b.scheduledAt).toISOString();
  }
  return { firebaseUid: b.firebaseUid, creativeVersionId: b.creativeVersionId, idempotencyKey: b.idempotencyKey, scheduledAt };
}

export async function enqueueSend(i: { firebaseUid: string; creativeVersionId: string; idempotencyKey: string; scheduledAt: string | null }, requestedBy: string) {
  const { data, error } = await controlDb().rpc("enqueue_push_send", {
    p_firebase_uid: i.firebaseUid, p_version_id: i.creativeVersionId, p_idempotency_key: i.idempotencyKey, p_scheduled_at: i.scheduledAt, p_requested_by: requestedBy,
  });
  if (error) throw new Error(error.message.split("\n")[0]);
  return data as Send;
}

export async function listSends(cursor: string | null, limit = 50) {
  let q = controlDb().from("push_send").select("*").order("requested_at", { ascending: false }).order("id", { ascending: false }).limit(limit);
  if (cursor) q = q.lt("requested_at", cursor);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data as Send[];
}

/** Send with per-device outcomes and taps. Attempt rows carry a token hash only; no token exists in B. */
export async function getSendDetail(id: string) {
  const db = controlDb();
  const [s, a, t] = await Promise.all([
    db.from("push_send").select("*").eq("id", id).maybeSingle(),
    db.from("push_device_attempt").select("id,device_id,attempt_no,provider,outcome,provider_message_id,error_code,created_at,settled_at").eq("send_id", id).order("created_at"),
    db.from("push_tap").select("id,event_id,opened_at,received_at").eq("send_id", id).order("opened_at"),
  ]);
  const err = s.error ?? a.error ?? t.error;
  if (err) throw new Error(err.message);
  if (!s.data) return null;
  return { send: s.data as Send, attempts: a.data ?? [], taps: t.data ?? [] };
}

export async function listApprovedVersions() {
  const { data, error } = await controlDb().from("push_creative_version").select("id,creative_id,version,title_template,body_template,route_key,approved_at").order("approved_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data;
}

export async function listAllowlist() {
  const { data, error } = await controlDb().from("push_allowlist").select("*").order("added_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as { firebase_uid: string; enabled: boolean; reason: string; added_by: string; added_at: string }[];
}
