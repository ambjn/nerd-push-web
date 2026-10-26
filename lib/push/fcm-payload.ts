import type { Rendered } from "./creative";

/**
 * Pure FCM HTTP v1 message builder. Data-only so the Android app renders exactly one banner
 * and receives send_id/route_key in every state (foreground, background, cold start).
 */
export function buildFcmMessage(token: string, sendId: string, r: Rendered) {
  return {
    message: {
      token,
      data: { title: r.title, body: r.body, send_id: sendId, route_key: r.route_key },
      android: { priority: "HIGH" as const, ttl: "3600s" },
    },
  };
}
