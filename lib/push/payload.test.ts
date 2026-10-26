import { expect, test } from "bun:test";
import fixture from "./fixtures/transactional-payload.json";
import { buildFcmMessage, validateFcmMessage } from "./payload";

test("builder matches the fixture shared with the Android parser, fixed key order, strings only", () => {
  const m = buildFcmMessage("<device token, memory only>", { eventId: "11111111-1111-4111-8111-111111111111", targetUserId: "firebase-uid-123", title: "Your plan is ready", body: "Open your study plan.", notificationType: "nerdpush_transactional", route: "study_plan" });
  expect(m).toEqual(fixture as unknown as typeof m);
  expect(Object.keys(m.message.data)).toEqual(["title", "message", "event_source", "event_id", "notification_type", "route", "target_user_id", "collapse_key"]);
  expect(Object.values(m.message.data).every((v) => typeof v === "string")).toBe(true);
  expect("notification" in m.message.android).toBe(false);
  expect(validateFcmMessage(m)).toEqual([]);
});
test("marketing adds the offers channel; web_url only when present; size guard", () => {
  const m = buildFcmMessage("t", { eventId: "e", targetUserId: "u", title: "T", body: "B", notificationType: "nerdpush_marketing", route: "home", webUrl: "https://example.com/x" });
  expect(m.message.android.notification).toEqual({ channel_id: "offers_and_tips" });
  expect(m.message.data.web_url).toBe("https://example.com/x");
  const big = buildFcmMessage("t", { eventId: "e", targetUserId: "u", title: "T", body: "x".repeat(4000), notificationType: "nerdpush_transactional", route: "home" });
  expect(validateFcmMessage(big)).toEqual(["payload_too_large"]);
});
