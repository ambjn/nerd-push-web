import { expect, test } from "bun:test";
import { fingerprint, lintCreative, render } from "./creative";
import { buildFcmMessage } from "./fcm-payload";

const ok = { title_template: "Hi {{display_name}}", body_template: "Your report is ready.", route_key: "home" as const, message_class: "transactional" as const };

test("lint catches the v1 rules", () => {
  expect(lintCreative(ok)).toEqual([]);
  expect(lintCreative({ ...ok, title_template: "" })).toContain("title_empty");
  expect(lintCreative({ ...ok, body_template: "x".repeat(241) })).toContain("body_too_long");
  expect(lintCreative({ ...ok, route_key: "settings" as never })).toContain("route_key_invalid");
  expect(lintCreative({ ...ok, message_class: "marketing" })).toContain("message_class_not_transactional");
  expect(lintCreative({ ...ok, body_template: "see {{url}}" })).toContain("unknown_var:url");
  expect(lintCreative({ ...ok, body_template: "a\x07b" })).toContain("control_chars");
  expect(lintCreative({ ...ok, body_template: "{{ oops" })).toContain("unbalanced_braces");
});

test("fingerprint is stable and content-sensitive", () => {
  expect(fingerprint(ok)).toBe(fingerprint({ ...ok }));
  expect(fingerprint(ok)).not.toBe(fingerprint({ ...ok, route_key: "details" }));
  expect(fingerprint(ok)).toMatch(/^[0-9a-f]{64}$/);
});

test("render substitutes and trims", () => {
  expect(render(ok, { display_name: "Amber" }).title).toBe("Hi Amber");
  expect(render(ok, { display_name: null }).title).toBe("Hi");
});

test("fcm payload is data-only with routing fields", () => {
  const m = buildFcmMessage("tok", "send-1", render(ok, { display_name: "A" })).message;
  expect(m.data.send_id).toBe("send-1");
  expect(m.data.route_key).toBe("home");
  expect("notification" in m).toBe(false);
});
