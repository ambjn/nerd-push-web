import { db } from "./db";
import { fingerprint, lintCreative, notificationType, type CreativeContent, type NotificationType } from "./push/creative";

export type Creative = CreativeContent & { id: string; label: string; notification_type: NotificationType; status: "draft" | "approved"; row_version: number; created_by: string; created_at: string; updated_at: string };
export type CreativeVersion = CreativeContent & { id: string; creative_id: string; version: number; notification_type: NotificationType; artifact_sha256: string; approved_by: string; approved_at: string };

/** Trust-boundary parse; partial for PATCH. */
export function parseInput(x: unknown, partial = false): Partial<Creative> | { error: string } {
  if (!x || typeof x !== "object") return { error: "bad_json" };
  const b = x as Record<string, unknown>, out: Record<string, unknown> = {};
  for (const k of ["label", "title", "body", "message_class", "route", "web_url"] as const) {
    if (b[k] === undefined) { if (!partial && k !== "web_url") return { error: `missing_${k}` }; continue; }
    if (k === "web_url" && (b[k] === null || b[k] === "")) { out[k] = null; continue; }
    if (typeof b[k] !== "string" || (b[k] as string).length > 2000) return { error: `bad_${k}` };
    out[k] = b[k];
  }
  if (typeof out.label === "string" && (out.label.length < 1 || out.label.length > 120)) return { error: "bad_label" };
  if (out.message_class !== undefined && out.message_class !== "transactional" && out.message_class !== "marketing") return { error: "bad_message_class" };
  if (out.message_class) out.notification_type = notificationType(out.message_class as "transactional" | "marketing");
  return out as Partial<Creative>;
}

export async function listCreatives() { const { data, error } = await db().from("push_creative").select("*").order("created_at", { ascending: false }); if (error) throw new Error(error.message); return data as Creative[]; }
export async function getCreative(id: string) { const { data, error } = await db().from("push_creative").select("*").eq("id", id).maybeSingle(); if (error) throw new Error(error.message); return data as Creative | null; }
export async function listVersions(creativeId: string) { const { data, error } = await db().from("push_creative_version").select("*").eq("creative_id", creativeId).order("version", { ascending: false }); if (error) throw new Error(error.message); return data as CreativeVersion[]; }
export async function createCreative(actor: string, input: Partial<Creative>) { const { data, error } = await db().from("push_creative").insert({ ...input, created_by: actor }).select("*").single(); if (error) throw new Error(error.message); return { creative: data as Creative, lint: lintCreative(data as Creative) }; }
export async function patchCreative(id: string, rowVersion: number, patch: Partial<Creative>) {
  const { data, error } = await db().from("push_creative").update(patch).eq("id", id).eq("row_version", rowVersion).eq("status", "draft").select("*").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { creative: data as Creative, lint: lintCreative(data as Creative) } : null;
}
export async function approveCreative(id: string, actor: string, rowVersion: number) {
  const c = await getCreative(id);
  if (!c) return { error: "not_found", status: 404 } as const;
  const lint = lintCreative(c);
  if (lint.length) return { error: "lint_failed", lint, status: 422 } as const;
  const { data, error } = await db().rpc("approve_push_creative", { p_id: id, p_actor: actor, p_row_version: rowVersion, p_sha256: fingerprint(c) });
  if (error) { const m = error.message.split("\n")[0]; return { error: m, status: /stale|not_draft/.test(m) ? 409 : 500 } as const; }
  return { versionId: data as string } as const;
}
