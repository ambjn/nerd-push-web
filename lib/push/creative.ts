import { createHash } from "node:crypto";
import { IMPLEMENTED_ROUTES, isApprovedUrl, isRouteKey, type RouteKey } from "./routes";

export type MessageClass = "transactional" | "marketing";
export type NotificationType = "nerdpush_transactional" | "nerdpush_marketing";
export type CreativeContent = { title: string; body: string; message_class: MessageClass; route: RouteKey; web_url: string | null };

export const LIMITS = { titleBytes: 120, bodyBytes: 500 } as const;
export const bytes = (s: string) => new TextEncoder().encode(s).length;
export const notificationType = (c: MessageClass): NotificationType => (c === "marketing" ? "nerdpush_marketing" : "nerdpush_transactional");
const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

/** Pure lint with stable codes. Empty means approvable. */
export function lintCreative(c: Partial<CreativeContent>): string[] {
  const e = new Set<string>();
  const title = c.title ?? "", body = c.body ?? "";
  if (!title.trim()) e.add("title_empty");
  if (bytes(title) > LIMITS.titleBytes) e.add("title_too_long");
  if (/\n/.test(title)) e.add("title_multiline");
  if (!body.trim()) e.add("body_empty");
  if (bytes(body) > LIMITS.bodyBytes) e.add("body_too_long");
  if (CONTROL.test(title) || CONTROL.test(body)) e.add("control_chars");
  if (!isRouteKey(c.route)) e.add("route_invalid"); else if (!IMPLEMENTED_ROUTES.has(c.route)) e.add("route_not_implemented");
  if (c.web_url != null && !isApprovedUrl(c.web_url)) e.add("url_invalid");
  if (c.message_class !== "transactional" && c.message_class !== "marketing") e.add("class_invalid");
  return [...e];
}

/** Render contract = the frozen fields; the fingerprint is the approval artifact. */
export function fingerprint(c: CreativeContent): string {
  return createHash("sha256").update(JSON.stringify([1, c.title, c.body, c.message_class, c.route, c.web_url ?? null])).digest("hex");
}
export const fingerprintMatches = (v: CreativeContent & { artifact_sha256: string }) => fingerprint(v) === v.artifact_sha256;
