import type { SourceState } from "@/lib/app-source/read";

export const POLICY = { max24h: 1, max7d: 3, windowStartHour: 8, windowEndHour: 22 } as const;

export type Eligibility = { eligible: true } | { eligible: false; reason: string; deferUntil?: string };

/** Local hour of `now` in an IANA zone; falls back to UTC on a bad zone. */
export function localHour(now: Date, timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone }).format(now)) % 24;
  } catch {
    return now.getUTCHours();
  }
}

/** Next 08:00 local as an ISO string for quiet-hours deferral. */
export function nextWindowStart(now: Date, timezone: string): string {
  const h = localHour(now, timezone);
  const hoursAhead = h >= POLICY.windowEndHour ? 24 - h + POLICY.windowStartHour : POLICY.windowStartHour - h;
  const t = new Date(now.getTime() + hoursAhead * 3600_000);
  t.setUTCMinutes(0, 0, 0);
  return t.toISOString();
}

/**
 * Pure v1 eligibility. The caps here are advisory for previews; the authoritative cap
 * check runs inside np.reserve_push_send under the row lock.
 */
export function evaluateEligibility(i: {
  source: SourceState; allowlisted: boolean; messageClass: string; now: Date; sentLast24h: number; sentLast7d: number;
}): Eligibility {
  if (!i.allowlisted) return { eligible: false, reason: "not_allowlisted" };
  if (i.messageClass !== "transactional") return { eligible: false, reason: "marketing_disabled" };
  if (!i.source.user) return { eligible: false, reason: "no_user" };
  const devices = i.source.devices.filter((d) => d.notifications_enabled !== false);
  if (devices.length === 0) return { eligible: false, reason: "no_eligible_device" };
  if (i.sentLast24h >= POLICY.max24h) return { eligible: false, reason: "cap_24h" };
  if (i.sentLast7d >= POLICY.max7d) return { eligible: false, reason: "cap_7d" };
  const h = localHour(i.now, i.source.user.timezone);
  if (h < POLICY.windowStartHour || h >= POLICY.windowEndHour) {
    return { eligible: false, reason: "quiet_hours", deferUntil: nextWindowStart(i.now, i.source.user.timezone) };
  }
  return { eligible: true };
}
