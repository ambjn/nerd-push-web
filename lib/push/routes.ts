/** Route allowlist shared with the Android app (Routes.kt). Only routes the Android build handles are offered. */
export const ROUTE_KEYS = ["home", "schedule", "messages", "account", "study_plan"] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];
export const IMPLEMENTED_ROUTES: ReadonlySet<RouteKey> = new Set<RouteKey>(["home", "schedule", "messages", "account", "study_plan"]);
export const isRouteKey = (x: unknown): x is RouteKey => typeof x === "string" && (ROUTE_KEYS as readonly string[]).includes(x);
/** Optional URL must be HTTPS on an approved host. */
export const APPROVED_URL_HOSTS = (process.env.PUSH_APPROVED_URL_HOSTS ?? "").split(",").map((h) => h.trim()).filter(Boolean);
export function isApprovedUrl(url: string): boolean {
  try { const u = new URL(url); return u.protocol === "https:" && (APPROVED_URL_HOSTS.length === 0 || APPROVED_URL_HOSTS.includes(u.hostname)); } catch { return false; }
}
