import { expect, test } from "bun:test";
import { fingerprint } from "./creative";
import { mockProvider } from "./mock";
import type { PushProvider } from "./provider";
import { classify, runTestSend, type Version } from "./test-send";

const content = { title: "Hi", body: "Ready.", message_class: "transactional" as const, route: "home" as const, web_url: null };
const version: Version = { id: "v1", ...content, notification_type: "nerdpush_transactional", artifact_sha256: fingerprint(content) };
const device = (token = "ok-1", marketing_choice: "opted_in" | "opted_out" | null = null) => ({ firebase_uid: "u1", display_name: null, token, marketing_choice, updated_at: "" });
function counting(): PushProvider & { calls: number } { const p = { name: "mock" as const, calls: 0, async send(m: Parameters<PushProvider["send"]>[0]) { p.calls++; return mockProvider.send(m); } }; return p; }
const base = { eventId: "11111111-1111-4111-8111-111111111111", firebaseUid: "u1", version, device: device(), allowlist: new Set(["u1"]) };

test("happy path: one provider call, [TEST] prefix, token hash only", async () => {
  const p = counting();
  const r = await runTestSend({ ...base, provider: p });
  expect(p.calls).toBe(1);
  expect(r.status).toBe("accepted");
  expect(r.title).toBe("[TEST] Hi");
  expect(JSON.stringify(r)).not.toContain("ok-1");
  expect(r.outcomes[0].token_sha256).toMatch(/^[0-9a-f]{64}$/);
});
test("zero FCM calls: non-allowlisted, changed version, no device, opted-out marketing, bad route, oversize payload", async () => {
  const cases = [
    [{ ...base, allowlist: new Set<string>() }, "not_on_test_allowlist"],
    [{ ...base, version: { ...version, body: "edited" } }, "approval_fence"],
    [{ ...base, device: null }, "no_device"],
    [{ ...base, version: { ...version, message_class: "marketing" as const, notification_type: "nerdpush_marketing" as const, artifact_sha256: fingerprint({ ...content, message_class: "marketing" }) }, device: device("ok", "opted_out") }, "marketing_opted_out"],
    [{ ...base, version: { ...version, route: "settings" as never, artifact_sha256: fingerprint({ ...content, route: "settings" as never }) } }, "route_invalid"],
    [{ ...base, version: { ...version, body: "x".repeat(4000), artifact_sha256: fingerprint({ ...content, body: "x".repeat(4000) }) } }, "payload_too_large"],
  ] as const;
  for (const [input, reason] of cases) {
    const p = counting();
    const r = await runTestSend({ ...input, provider: p });
    expect(p.calls).toBe(0);
    expect(r.error).toBe(reason);
  }
});
test("classification", () => {
  expect(classify(["proven_dead_token"])).toEqual({ status: "skipped", error: "dead_token" });
  expect(classify(["ambiguous"])).toEqual({ status: "delivery_unknown", error: "ambiguous" });
  expect(classify(["accepted", "ambiguous"])).toEqual({ status: "accepted", error: "partial_unknown" });
});
