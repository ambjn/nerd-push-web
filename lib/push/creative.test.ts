import { expect, test } from "bun:test";
import { fingerprint, fingerprintMatches, lintCreative } from "./creative";

const ok = { title: "Hi", body: "Your plan is ready.", message_class: "transactional" as const, route: "home" as const, web_url: null };
test("lint: bytes, route allowlist, https url, class, control chars", () => {
  expect(lintCreative(ok)).toEqual([]);
  expect(lintCreative({ ...ok, title: "é".repeat(61) })).toContain("title_too_long");
  expect(lintCreative({ ...ok, body: "x".repeat(501) })).toContain("body_too_long");
  expect(lintCreative({ ...ok, route: "settings" as never })).toContain("route_invalid");
  expect(lintCreative({ ...ok, web_url: "http://x" })).toContain("url_invalid");
  expect(lintCreative({ ...ok, body: "a\u0007" })).toContain("control_chars");
  expect(lintCreative({ ...ok, message_class: "x" as never })).toContain("class_invalid");
});
test("fingerprint is the approval artifact", () => {
  expect(fingerprintMatches({ ...ok, artifact_sha256: fingerprint(ok) })).toBe(true);
  expect(fingerprintMatches({ ...ok, body: "edited", artifact_sha256: fingerprint(ok) })).toBe(false);
});
