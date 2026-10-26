import { createClient } from "@supabase/supabase-js";

/** Server-only Supabase client (service role). Never import from client components. */
export function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

export type Device = { firebase_uid: string; display_name: string | null; token: string; updated_at: string };
