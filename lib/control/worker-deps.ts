import { readSourceState } from "@/lib/app-source/read";
import type { WorkerDeps } from "@/lib/push/worker";
import { controlDb } from "./db";

function unwrap<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Supabase B implementation of the worker's contract: every mutation goes through an np.* function. */
export const supabaseWorkerDeps: WorkerDeps = {
  claim: async (owner, limit) => unwrap(await controlDb().rpc("claim_due_push_sends", { p_owner: owner, p_limit: limit })) ?? [],
  getVersion: async (id) => unwrap(await controlDb().from("push_creative_version").select("*").eq("id", id).maybeSingle()),
  isAllowlisted: async (uid) => (unwrap(await controlDb().from("push_allowlist").select("enabled").eq("firebase_uid", uid).maybeSingle()))?.enabled === true,
  readSource: readSourceState,
  release: async (sendId, owner, next, code) => { unwrap(await controlDb().rpc("release_push_claim", { p_send_id: sendId, p_owner: owner, p_next_attempt_at: next, p_error_code: code })); },
  skip: async (sendId, owner, code) => { unwrap(await controlDb().rpc("skip_push_send", { p_send_id: sendId, p_owner: owner, p_error_code: code })); },
  reserve: async (sendId, owner, versionId, sha, deviceIds, snapshot) =>
    unwrap(await controlDb().rpc("reserve_push_send", { p_send_id: sendId, p_owner: owner, p_version_id: versionId, p_sha256: sha, p_device_ids: deviceIds, p_snapshot: snapshot })),
  authorizations: async (reservationId) => unwrap(await controlDb().from("push_attempt_authorization").select("id,device_id").eq("reservation_id", reservationId).is("consumed_at", null)) ?? [],
  consume: async (authId, owner, tokenSha, provider) =>
    unwrap(await controlDb().rpc("consume_attempt_authorization", { p_auth_id: authId, p_owner: owner, p_token_sha256: tokenSha, p_provider: provider })),
  settleAttempt: async (attemptId, owner, outcome, messageId, code) => {
    unwrap(await controlDb().rpc("settle_push_device_attempt", { p_attempt_id: attemptId, p_owner: owner, p_outcome: outcome, p_message_id: messageId, p_error_code: code }));
  },
  settleSend: async (sendId, owner, status, code) => { unwrap(await controlDb().rpc("settle_push_send", { p_send_id: sendId, p_owner: owner, p_status: status, p_error_code: code })); },
  requeue: async (sendId, owner, next, code) => { unwrap(await controlDb().rpc("requeue_push_send", { p_send_id: sendId, p_owner: owner, p_next_attempt_at: next, p_error_code: code })); },
};
