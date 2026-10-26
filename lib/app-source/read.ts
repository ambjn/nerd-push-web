import { createClient } from "@supabase/supabase-js";

export type SourceDevice = { id: string; token: string; token_sha256: string; provider: "fcm" | "apns"; notifications_enabled: boolean | null };
export type SourceState = {
  user: { firebase_uid: string; timezone: string; display_name?: string | null } | null;
  marketing_choice: "opted_in" | "opted_out" | null;
  devices: SourceDevice[];
};

/** Supabase A SELECT-only client (role source_reader). The worker never writes A. */
function reader() {
  const url = process.env.APP_SOURCE_SUPABASE_URL;
  const jwt = process.env.APP_SOURCE_READER_JWT;
  if (!url || !jwt) throw new Error("APP_SOURCE_SUPABASE_URL / APP_SOURCE_READER_JWT missing");
  return createClient(url, jwt, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt}` } } });
}

/** Throws on transport failure so the caller defers instead of recording a provider attempt. */
export async function readSourceState(firebaseUid: string): Promise<SourceState> {
  const db = reader();
  const [u, p, d] = await Promise.all([
    db.from("app_user").select("firebase_uid,timezone,display_name").eq("firebase_uid", firebaseUid).maybeSingle(),
    db.from("notification_preference").select("marketing_choice").eq("firebase_uid", firebaseUid).maybeSingle(),
    db.from("push_device").select("id,token,token_sha256,provider,notifications_enabled")
      .eq("firebase_uid", firebaseUid).is("revoked_at", null).limit(20),
  ]);
  const err = u.error ?? p.error ?? d.error;
  if (err) throw new Error(`source_read_failed: ${err.message}`);
  return { user: u.data, marketing_choice: p.data?.marketing_choice ?? null, devices: d.data ?? [] };
}

/** Recipient lookup for the dashboard: never returns tokens. */
export async function lookupRecipient(firebaseUid: string) {
  const db = reader();
  const { data, error } = await db.from("push_device").select("id,platform,notifications_enabled,last_seen_at")
    .eq("firebase_uid", firebaseUid).is("revoked_at", null).limit(20);
  if (error) throw new Error(`source_read_failed: ${error.message}`);
  return data;
}
