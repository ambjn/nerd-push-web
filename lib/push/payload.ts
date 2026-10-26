import type { NotificationType } from "./creative";
import type { RouteKey } from "./routes";

/** Data map limit (bytes of the encoded data map). */
export const DATA_MAX_BYTES = 3584;
export const EVENT_SOURCE = "NerdPush";

export type PushInput = { eventId: string; targetUserId: string; title: string; body: string; notificationType: NotificationType; route: RouteKey; webUrl?: string | null };

/**
 * The sole FCM payload builder: notification plus string-only data, fixed key order. No network.
 * Pinned by payload.test.ts and lib/push/fixtures/transactional-payload.json (also read by the Android parser test).
 */
export function buildFcmMessage(token: string, i: PushInput) {
  const data: Record<string, string> = {
    title: i.title, message: i.body, event_source: EVENT_SOURCE, event_id: i.eventId, notification_type: i.notificationType,
    route: i.route, target_user_id: i.targetUserId, collapse_key: "update_notification",
  };
  if (i.webUrl) data.web_url = i.webUrl;
  const android: { priority: "high"; notification?: { channel_id: "offers_and_tips" } } = { priority: "high" };
  if (i.notificationType === "nerdpush_marketing") android.notification = { channel_id: "offers_and_tips" };
  return { message: { token, notification: { title: i.title, body: i.body }, data, android } };
}
export type FcmMessage = ReturnType<typeof buildFcmMessage>;

/** Stable error codes for a message that must not be sent. */
export function validateFcmMessage(m: FcmMessage): string[] {
  const errors: string[] = [];
  if (new TextEncoder().encode(JSON.stringify(m.message.data)).length > DATA_MAX_BYTES) errors.push("payload_too_large");
  for (const [k, v] of Object.entries(m.message.data)) if (typeof v !== "string") errors.push(`data_not_string:${k}`);
  if (m.message.data.web_url && !/^https:\/\//.test(m.message.data.web_url)) errors.push("web_url_not_https");
  if (!m.message.token) errors.push("token_missing");
  return errors;
}
