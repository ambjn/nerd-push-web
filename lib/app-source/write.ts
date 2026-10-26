import { createClient } from "@supabase/supabase-js";

/** Supabase A write client. Only the app-owned registration routes import this. */
function writer() {
  const url = process.env.APP_SOURCE_SUPABASE_URL;
  const key = process.env.APP_SOURCE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("APP_SOURCE_SUPABASE_URL / APP_SOURCE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export const APP_ID = "com.ambjn.neshpushandroid";

export async function registerDevice(uid: string, r: RegisterBody) {
  const { data, error } = await writer().rpc("register_push_device", {
    p_firebase_uid: uid,
    p_installation_id: r.installationId,
    p_token: r.token,
    p_platform: r.platform,
    p_app_id: APP_ID,
    p_notifications_enabled: r.notificationsEnabled,
    p_display_name: r.displayName ?? null,
    p_timezone: r.timezone ?? "UTC",
  });
  if (error) throw new Error(error.code === "22023" ? "invalid_timezone" : error.message);
  return data as string;
}

export async function revokeDevice(uid: string, installationId: string, platform: string) {
  const { error } = await writer().rpc("revoke_push_device", {
    p_firebase_uid: uid, p_installation_id: installationId, p_platform: platform, p_app_id: APP_ID,
  });
  if (error) throw new Error(error.message);
}

export type RegisterBody = {
  installationId: string;
  token: string;
  platform: "android";
  notificationsEnabled: boolean;
  displayName?: string;
  timezone?: string;
};

/** Trust-boundary validation of the registration request body. Returns a stable error code or the body. */
export function parseRegisterBody(x: unknown): RegisterBody | { error: string } {
  if (!x || typeof x !== "object") return { error: "bad_json" };
  const b = x as Record<string, unknown>;
  if (typeof b.installationId !== "string" || b.installationId.length < 8 || b.installationId.length > 128) return { error: "bad_installation_id" };
  if (typeof b.token !== "string" || b.token.length < 16 || b.token.length > 4096) return { error: "bad_token" };
  if (b.platform !== "android") return { error: "bad_platform" };
  if (typeof b.notificationsEnabled !== "boolean") return { error: "bad_permission" };
  if (b.displayName !== undefined && (typeof b.displayName !== "string" || b.displayName.length > 200)) return { error: "bad_display_name" };
  if (b.timezone !== undefined && (typeof b.timezone !== "string" || b.timezone.length > 64)) return { error: "bad_timezone" };
  return b as RegisterBody;
}
