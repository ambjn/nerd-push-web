import { createHash } from "node:crypto";
import { db, type Device } from "@/lib/db";
import { readDevice } from "@/lib/reader";
import { fingerprintMatches, type CreativeContent, type NotificationType } from "./creative";
import { buildFcmMessage, validateFcmMessage } from "./payload";
import { selectProvider, type Outcome, type PushProvider } from "./provider";
import { IMPLEMENTED_ROUTES, isRouteKey } from "./routes";

export type Version = CreativeContent & { id: string; notification_type: NotificationType; artifact_sha256: string };
export type DeviceOutcome = { token_sha256: string; outcome: Outcome; provider_message_id?: string; error_code?: string };
export type Status = "accepted" | "skipped" | "failed" | "delivery_unknown";

/** Person-level result from device answers. Any acceptance wins; ambiguity never retries; all-dead is skipped. */
export function classify(outcomes: Outcome[]): { status: Status; error: string | null } {
  if (outcomes.includes("accepted")) return { status: "accepted", error: outcomes.includes("ambiguous") ? "partial_unknown" : null };
  if (outcomes.includes("ambiguous")) return { status: "delivery_unknown", error: "ambiguous" };
  if (outcomes.includes("configuration_error")) return { status: "failed", error: "configuration_error" };
  if (outcomes.includes("rate_limited")) return { status: "failed", error: "rate_limited" };
  if (outcomes.length && outcomes.every((o) => o === "proven_dead_token")) return { status: "skipped", error: "dead_token" };
  return { status: "failed", error: "no_outcome" };
}

/**
 * Pure decision + fan-out, injectable for tests. The allowlist is the registered-users table read through the
 * read-only bridge: an unregistered UID, an unapproved/changed version, an opted-out marketing choice, an invalid
 * route or a bad payload all make zero provider calls.
 */
export async function runTestSend(i: { eventId: string; firebaseUid: string; version: Version; device: Device | null; provider: PushProvider }): Promise<{ title: string; status: Status; error: string | null; outcomes: DeviceOutcome[] }> {
  const title = `[TEST] ${i.version.title}`.slice(0, 120);
  const no = (status: Status, error: string) => ({ title, status, error, outcomes: [] as DeviceOutcome[] });
  if (i.device === null || i.device.firebase_uid !== i.firebaseUid) return no("failed", "not_registered");
  if (!fingerprintMatches(i.version)) return no("failed", "approval_fence");
  if (!isRouteKey(i.version.route) || !IMPLEMENTED_ROUTES.has(i.version.route)) return no("failed", "route_invalid");
  if (i.version.message_class === "marketing" && i.device.marketing_choice === "opted_out") return no("skipped", "marketing_opted_out");
  const message = buildFcmMessage(i.device.token, { eventId: i.eventId, targetUserId: i.firebaseUid, title, body: i.version.body, notificationType: i.version.notification_type, route: i.version.route, webUrl: i.version.web_url });
  const bad = validateFcmMessage(message);
  if (bad.length) return no("failed", bad[0].slice(0, 64));
  const r = await i.provider.send(message);
  const outcomes: DeviceOutcome[] = [{ token_sha256: createHash("sha256").update(i.device.token).digest("hex"), outcome: r.outcome, provider_message_id: r.providerMessageId, error_code: r.errorCode }];
  const c = classify(outcomes.map((o) => o.outcome));
  return { title, status: c.status, error: c.error, outcomes };
}

/** Route-level wrapper: pinned version from the control tables, device through the read-only bridge, then the ledger. */
export async function testSend(actor: string, firebaseUid: string, versionId: string) {
  const { data: v } = await db().from("push_creative_version").select("*").eq("id", versionId).maybeSingle();
  if (!v) return { error: "version_not_found", status: 404 } as const;
  let device: Device | null;
  try { device = await readDevice(firebaseUid); } catch { return { error: "reader_unavailable", status: 503 } as const; }
  const provider = await selectProvider();
  if ("disabled" in provider) return { error: provider.reason, status: 503 } as const;
  const eventId = crypto.randomUUID();
  const r = await runTestSend({ eventId, firebaseUid, version: v as Version, device, provider });
  const { error } = await db().from("push_test_send").insert({ id: eventId, actor, firebase_uid: firebaseUid, creative_version_id: v.id, title: r.title, provider: provider.name, status: r.status, error_code: r.error, device_outcomes: r.outcomes });
  if (error) return { error: "ledger_write_failed", status: 500 } as const;
  return { id: eventId, provider: provider.name, ...r } as const;
}
