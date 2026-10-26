import { createClient } from "@supabase/supabase-js";

/** Supabase B service-role client on schema np. Server-side only; never import from client components. */
export function controlDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.CONTROL_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / CONTROL_SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false }, db: { schema: "np" } });
}

export type Role = "editor" | "sender" | "admin";
export type Creative = {
  id: string; label: string; title_template: string; body_template: string;
  route_key: "home" | "details"; message_class: "transactional" | "marketing";
  status: "draft" | "approved" | "archived"; row_version: number;
  created_by: string; approved_by: string | null; approved_at: string | null; created_at: string; updated_at: string;
};
export type CreativeVersion = {
  id: string; creative_id: string; version: number; title_template: string; body_template: string;
  route_key: "home" | "details"; message_class: "transactional" | "marketing"; artifact_sha256: string;
  approved_by: string; approved_at: string;
};

export async function audit(actor: string | null, action: string, entity: string, metadata: Record<string, unknown> = {}) {
  const { error } = await controlDb().from("operator_audit").insert({ actor, action, entity, metadata });
  if (error) throw new Error(`audit_failed: ${error.message}`);
}
