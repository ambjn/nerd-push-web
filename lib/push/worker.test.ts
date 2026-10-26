import { expect, test } from "bun:test";
import { classifySend, runWorker, type ClaimedSend, type Version, type WorkerDeps } from "./worker";
import { fingerprint } from "./creative";
import { mockProvider } from "./provider";
import type { SourceState } from "@/lib/app-source/read";

const content = { title_template: "Hi {{display_name}}", body_template: "Ready.", route_key: "home" as const, message_class: "transactional" as const };
const version: Version = { id: "v1", ...content, artifact_sha256: fingerprint(content) };
const device = (id: string, token: string) => ({ id, token, token_sha256: "", provider: "fcm" as const, notifications_enabled: true });

/** In-memory stand-in for the np.* functions, recording every call. */
function fakeDeps(opts: { source?: SourceState | Error; allowlisted?: boolean; reserveError?: string } = {}) {
  const calls: string[] = [];
  const src: SourceState = { user: { firebase_uid: "u1", timezone: "UTC", display_name: "Amber" }, marketing_choice: null, devices: [device("d1", "ok-1"), device("d2", "dead-2")] };
  const consumed = new Set<string>();
  const deps: WorkerDeps = {
    claim: async () => [{ id: "s1", firebase_uid: "u1", creative_version_id: "v1", retry_count: 0 } satisfies ClaimedSend],
    getVersion: async () => version,
    isAllowlisted: async () => opts.allowlisted ?? true,
    readSource: async () => { if (opts.source instanceof Error) throw opts.source; return opts.source ?? src; },
    release: async (_s, _o, next, code) => { calls.push(`release:${code}:${next}`); },
    skip: async (_s, _o, code) => { calls.push(`skip:${code}`); },
    reserve: async (_s, _o, _v, _sha, ids) => { if (opts.reserveError) throw new Error(opts.reserveError); calls.push(`reserve:${ids.join(",")}`); return "r1"; },
    authorizations: async () => [{ id: "a1", device_id: "d1" }, { id: "a2", device_id: "d2" }],
    consume: async (authId) => { if (consumed.has(authId)) throw new Error("authorization_consumed"); consumed.add(authId); calls.push(`consume:${authId}`); return `att-${authId}`; },
    settleAttempt: async (id, _o, outcome) => { calls.push(`attempt:${id}:${outcome}`); },
    settleSend: async (_s, _o, status, code) => { calls.push(`settle:${status}:${code}`); },
    requeue: async (_s, _o, _n, code) => { calls.push(`requeue:${code}`); },
  };
  return { deps, calls };
}
const run = (d: WorkerDeps) => runWorker(d, mockProvider, { owner: "w1", limit: 10, now: () => new Date("2026-10-26T12:00:00Z") });

test("full mock flow: reserve, one attempt per device, partial success is accepted", async () => {
  const { deps, calls } = fakeDeps();
  const r = await run(deps);
  expect(r).toEqual({ claimed: 1, settled: 1, errors: [] });
  expect(calls).toEqual(["reserve:d1,d2", "consume:a1", "attempt:att-a1:accepted", "consume:a2", "attempt:att-a2:proven_dead_token", "settle:accepted:null"]);
});

test("source outage releases without an attempt", async () => {
  const { deps, calls } = fakeDeps({ source: new Error("down") });
  await run(deps);
  expect(calls).toEqual(["release:source_unavailable:2026-10-26T12:05:00.000Z"]);
});

test("allowlist denial and no device are skipped, never attempted", async () => {
  let f = fakeDeps({ allowlisted: false });
  await run(f.deps);
  expect(f.calls).toEqual(["skip:not_allowlisted"]);
  f = fakeDeps({ source: { user: { firebase_uid: "u1", timezone: "UTC" }, marketing_choice: null, devices: [] } });
  await run(f.deps);
  expect(f.calls).toEqual(["skip:no_eligible_device"]);
});

test("permit refusal (cap) is recorded as skip with the SQL reason", async () => {
  const { deps, calls } = fakeDeps({ reserveError: "cap_24h" });
  await run(deps);
  expect(calls).toEqual(["skip:cap_24h"]);
});

test("ambiguous beats dead, rate limit retries, acceptance wins", () => {
  expect(classifySend(["proven_dead_token", "ambiguous"])).toEqual({ status: "delivery_unknown", error: "ambiguous" });
  expect(classifySend(["rate_limited", "proven_dead_token"])).toEqual({ status: "retry", error: "rate_limited" });
  expect(classifySend(["accepted", "ambiguous"])).toEqual({ status: "accepted", error: null });
  expect(classifySend(["proven_dead_token"])).toEqual({ status: "failed", error: "all_tokens_dead" });
});

test("quiet hours defers to the next local window", async () => {
  const { deps, calls } = fakeDeps();
  await runWorker(deps, mockProvider, { owner: "w1", limit: 10, now: () => new Date("2026-10-26T23:00:00Z") });
  expect(calls).toEqual(["release:quiet_hours:2026-10-27T08:00:00.000Z"]);
});
