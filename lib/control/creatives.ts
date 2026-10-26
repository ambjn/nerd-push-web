import { lintCreative, type CreativeContent } from "@/lib/push/creative";
import { controlDb, type Creative } from "./db";

export type CreativeInput = { label: string } & CreativeContent;

/** Trust-boundary parse of a create/patch body. Partial for PATCH. */
export function parseCreativeInput(x: unknown, partial = false): CreativeInput | Partial<CreativeInput> | { error: string } {
  if (!x || typeof x !== "object") return { error: "bad_json" };
  const b = x as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["label", "title_template", "body_template", "route_key", "message_class"] as const) {
    if (b[k] === undefined) { if (!partial) return { error: `missing_${k}` }; continue; }
    if (typeof b[k] !== "string" || (b[k] as string).length > 1000) return { error: `bad_${k}` };
    out[k] = b[k];
  }
  if (typeof out.label === "string" && (out.label.length < 1 || out.label.length > 80)) return { error: "bad_label" };
  return out as CreativeInput;
}

export async function listCreatives() {
  const { data, error } = await controlDb().from("push_creative").select("*").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data as Creative[];
}

export async function getCreative(id: string) {
  const { data, error } = await controlDb().from("push_creative").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Creative | null;
}

export async function createCreative(actor: string, input: CreativeInput) {
  const lint = lintCreative(input); // drafts may carry lint errors; surfaced, not blocking
  const { data, error } = await controlDb().from("push_creative").insert({ ...input, created_by: actor }).select("*").single();
  if (error) throw new Error(error.message);
  return { creative: data as Creative, lint };
}

/** Compare-and-swap edit: fails with "stale" when row_version moved. */
export async function patchCreative(id: string, expectedRowVersion: number, patch: Partial<CreativeInput>) {
  const { data, error } = await controlDb().from("push_creative").update(patch)
    .eq("id", id).eq("row_version", expectedRowVersion).eq("status", "draft").select("*").maybeSingle();
  if (error) throw new Error(error.code === "42501" ? "not_draft" : error.message);
  if (!data) return null;
  return { creative: data as Creative, lint: lintCreative(data as Creative) };
}
