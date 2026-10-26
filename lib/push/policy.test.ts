import { expect, test } from "bun:test";
import { evaluateEligibility, localHour, nextWindowStart } from "./policy";

const dev = { id: "d1", token: "t", token_sha256: "h", provider: "fcm" as const, notifications_enabled: true };
const base = { source: { user: { firebase_uid: "u", timezone: "UTC" }, marketing_choice: null, devices: [dev] }, allowlisted: true, messageClass: "transactional", now: new Date("2026-10-26T12:00:00Z"), sentLast24h: 0, sentLast7d: 0 };

test("eligibility order and reasons", () => {
  expect(evaluateEligibility(base)).toEqual({ eligible: true });
  expect(evaluateEligibility({ ...base, allowlisted: false })).toMatchObject({ reason: "not_allowlisted" });
  expect(evaluateEligibility({ ...base, messageClass: "marketing" })).toMatchObject({ reason: "marketing_disabled" });
  expect(evaluateEligibility({ ...base, source: { ...base.source, devices: [{ ...dev, notifications_enabled: false }] } })).toMatchObject({ reason: "no_eligible_device" });
  expect(evaluateEligibility({ ...base, sentLast24h: 1 })).toMatchObject({ reason: "cap_24h" });
  expect(evaluateEligibility({ ...base, sentLast7d: 3 })).toMatchObject({ reason: "cap_7d" });
  const quiet = evaluateEligibility({ ...base, now: new Date("2026-10-26T23:30:00Z") });
  expect(quiet).toMatchObject({ reason: "quiet_hours", deferUntil: "2026-10-27T08:00:00.000Z" });
});

test("local hour respects the zone", () => {
  expect(localHour(new Date("2026-10-26T23:30:00Z"), "Asia/Kolkata")).toBe(5);
  expect(localHour(new Date("2026-10-26T23:30:00Z"), "Not/AZone")).toBe(23);
  expect(nextWindowStart(new Date("2026-10-26T03:00:00Z"), "UTC")).toBe("2026-10-26T08:00:00.000Z");
});
