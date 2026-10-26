import { createHash } from "node:crypto";
import type { SourceState } from "@/lib/app-source/read";
import { fingerprint, render, type CreativeContent } from "./creative";
import { buildFcmMessage } from "./fcm-payload";
import { evaluateEligibility } from "./policy";
import type { Outcome, PushProvider } from "./provider";

export type ClaimedSend = { id: string; firebase_uid: string; creative_version_id: string; retry_count: number };
export type Version = CreativeContent & { id: string; artifact_sha256: string };

/** Everything the worker needs from B and A, so the flow is unit-testable without a database. */
export interface WorkerDeps {
  claim(owner: string, limit: number): Promise<ClaimedSend[]>;
  getVersion(id: string): Promise<Version | null>;
  isAllowlisted(uid: string): Promise<boolean>;
  readSource(uid: string): Promise<SourceState>;
  release(sendId: string, owner: string, nextAttemptAt: string, errorCode: string): Promise<void>;
  skip(sendId: string, owner: string, errorCode: string): Promise<void>;
  reserve(sendId: string, owner: string, versionId: string, sha256: string, deviceIds: string[], snapshot: unknown): Promise<string>;
  authorizations(reservationId: string): Promise<{ id: string; device_id: string }[]>;
  consume(authId: string, owner: string, tokenSha256: string, provider: string): Promise<string>;
  settleAttempt(attemptId: string, owner: string, outcome: Outcome, messageId: string | null, errorCode: string | null): Promise<void>;
  settleSend(sendId: string, owner: string, status: "accepted" | "failed" | "delivery_unknown", errorCode: string | null): Promise<void>;
  requeue(sendId: string, owner: string, nextAttemptAt: string, errorCode: string): Promise<void>;
}

export type WorkerReport = { claimed: number; settled: number; errors: { sendId: string; error: string }[] };

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Overall status from per-device outcomes. Any acceptance wins; ambiguity is never retried. */
export function classifySend(outcomes: Outcome[]): { status: "accepted" | "failed" | "delivery_unknown" | "retry"; error: string | null } {
  if (outcomes.includes("accepted")) return { status: "accepted", error: null };
  if (outcomes.includes("ambiguous")) return { status: "delivery_unknown", error: "ambiguous" };
  if (outcomes.includes("rate_limited")) return { status: "retry", error: "rate_limited" };
  if (outcomes.includes("configuration_error")) return { status: "failed", error: "configuration_error" };
  return { status: "failed", error: "all_tokens_dead" };
}

export async function runWorker(deps: WorkerDeps, provider: PushProvider, opts: { owner: string; limit: number; now?: () => Date }): Promise<WorkerReport> {
  const now = opts.now ?? (() => new Date());
  const report: WorkerReport = { claimed: 0, settled: 0, errors: [] };
  const sends = await deps.claim(opts.owner, opts.limit);
  report.claimed = sends.length;
  for (const s of sends) {
    try {
      await processSend(s);
      report.settled++;
    } catch (e) {
      // ponytail: an unexpected throw leaves the claim for recover_stale_push_claims; no provider request is repeated.
      report.errors.push({ sendId: s.id, error: (e as Error).message.slice(0, 200) });
    }
  }
  return report;

  async function processSend(s: ClaimedSend) {
    const owner = opts.owner;
    const version = await deps.getVersion(s.creative_version_id);
    if (!version || fingerprint(version) !== version.artifact_sha256) return deps.skip(s.id, owner, "version_invalid");

    let source: SourceState;
    try { source = await deps.readSource(s.firebase_uid); }
    catch { return deps.release(s.id, owner, new Date(now().getTime() + 5 * 60_000).toISOString(), "source_unavailable"); }

    const allowlisted = await deps.isAllowlisted(s.firebase_uid);
    const elig = evaluateEligibility({ source, allowlisted, messageClass: version.message_class, now: now(), sentLast24h: 0, sentLast7d: 0 });
    if (!elig.eligible) {
      if (elig.reason === "quiet_hours" && elig.deferUntil) return deps.release(s.id, owner, elig.deferUntil, "quiet_hours");
      return deps.skip(s.id, owner, elig.reason);
    }

    const rendered = render(version, { display_name: source.user?.display_name ?? null });
    const devices = source.devices.filter((d) => d.notifications_enabled !== false && d.provider === "fcm");
    const snapshot = { rendered, version_id: version.id, sha256: version.artifact_sha256, device_count: devices.length };

    let reservationId: string;
    try { reservationId = await deps.reserve(s.id, owner, version.id, version.artifact_sha256, devices.map((d) => d.id), snapshot); }
    catch (e) {
      const code = (e as Error).message.split("\n")[0].slice(0, 64);
      return deps.skip(s.id, owner, code); // allowlist, caps, class, fingerprint: all definite, all recorded, no attempt
    }

    const auths = await deps.authorizations(reservationId);
    const outcomes: Outcome[] = [];
    for (const auth of auths) {
      const device = devices.find((d) => d.id === auth.device_id);
      if (!device) continue;
      const attemptId = await deps.consume(auth.id, owner, device.token_sha256 || sha256(device.token), provider.name);
      const result = await provider.send(buildFcmMessage(device.token, s.id, rendered));
      await deps.settleAttempt(attemptId, owner, result.outcome, result.providerMessageId ?? null, result.errorCode ?? null);
      outcomes.push(result.outcome);
    }
    const c = classifySend(outcomes);
    if (c.status === "retry") return deps.requeue(s.id, owner, new Date(now().getTime() + 2 ** s.retry_count * 60_000).toISOString(), c.error!);
    return deps.settleSend(s.id, owner, c.status, c.error);
  }
}
