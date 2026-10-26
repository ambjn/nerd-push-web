import { expect, test } from "bun:test";
import { parseRegisterBody } from "./write";

test("rejects a claimed uid in the body and bad shapes", () => {
  expect(parseRegisterBody(null)).toEqual({ error: "bad_json" });
  expect(parseRegisterBody({ installationId: "short", token: "x".repeat(20), platform: "android", notificationsEnabled: true })).toEqual({ error: "bad_installation_id" });
  expect(parseRegisterBody({ installationId: "a".repeat(16), token: "short", platform: "android", notificationsEnabled: true })).toEqual({ error: "bad_token" });
  expect(parseRegisterBody({ installationId: "a".repeat(16), token: "x".repeat(20), platform: "ios", notificationsEnabled: true })).toEqual({ error: "bad_platform" });
  const ok = parseRegisterBody({ installationId: "a".repeat(16), token: "x".repeat(20), platform: "android", notificationsEnabled: false, firebaseUid: "attacker" });
  expect("error" in ok).toBe(false);
});
