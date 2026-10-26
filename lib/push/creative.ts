import { createHash } from "node:crypto";

export const ROUTE_KEYS = ["home", "details"] as const;
export type RouteKey = (typeof ROUTE_KEYS)[number];
export type MessageClass = "transactional" | "marketing";

export type CreativeContent = {
  title_template: string;
  body_template: string;
  route_key: RouteKey;
  message_class: MessageClass;
};

export const LIMITS = { title: 65, body: 240 } as const;
const ALLOWED_VARS = new Set(["display_name"]);
const CONTROL_CHARS = /[\x00-\x08\x0b-\x1f\x7f]/;
const VAR = /\{\{\s*([a-z_]+)\s*\}\}/g;

/** Pure lint. Empty array means the content is publishable. */
export function lintCreative(c: Partial<CreativeContent>): string[] {
  const errors: string[] = [];
  const title = c.title_template ?? "";
  const body = c.body_template ?? "";
  if (!title.trim()) errors.push("title_empty");
  if (title.length > LIMITS.title) errors.push("title_too_long");
  if (!body.trim()) errors.push("body_empty");
  if (body.length > LIMITS.body) errors.push("body_too_long");
  if (CONTROL_CHARS.test(title) || CONTROL_CHARS.test(body)) errors.push("control_chars");
  if (/\n/.test(title)) errors.push("title_multiline");
  if (!ROUTE_KEYS.includes(c.route_key as RouteKey)) errors.push("route_key_invalid");
  if (c.message_class !== "transactional") errors.push("message_class_not_transactional"); // v1: marketing disabled
  for (const text of [title, body]) {
    for (const m of text.matchAll(VAR)) if (!ALLOWED_VARS.has(m[1])) errors.push(`unknown_var:${m[1]}`);
    if ((text.match(/\{\{/g)?.length ?? 0) !== (text.match(VAR)?.length ?? 0)) errors.push("unbalanced_braces");
  }
  return [...new Set(errors)];
}

/** Canonical artifact fingerprint; must match np.creative_fingerprint in SQL. */
export function fingerprint(c: CreativeContent): string {
  return createHash("sha256")
    .update([c.title_template, c.body_template, c.route_key, c.message_class].join("\x1f"))
    .digest("hex");
}

export type Rendered = { title: string; body: string; route_key: RouteKey };

/** Exact render with the recipient's variables. Missing vars render as empty text. */
export function render(c: CreativeContent, vars: { display_name?: string | null }): Rendered {
  const sub = (t: string) => t.replace(VAR, (_, k: string) => (k === "display_name" ? (vars.display_name ?? "").trim() : "")).replace(/[ ]{2,}/g, " ").trim();
  return { title: sub(c.title_template), body: sub(c.body_template), route_key: c.route_key };
}
