import postgres from "postgres";
import type { Device } from "./db";

/** Read-only bridge to the registered (logged-in) users: role nerdpush_reader can only SELECT push_device. One pooled client per server instance. */
let client: ReturnType<typeof postgres> | null = null;
function reader() {
  if (client) return client;
  const url = process.env.SUPABASE_READONLY_URL;
  if (!url) throw new Error("SUPABASE_READONLY_URL missing");
  client = postgres(url, { prepare: false, max: 2, idle_timeout: 20, connect_timeout: 10, ssl: "require" });
  return client;
}

/** Current device for one Firebase UID; the token stays in server memory only. */
export async function readDevice(firebaseUid: string): Promise<Device | null> {
  const rows = await reader()<Device[]>`select firebase_uid, display_name, token, marketing_choice, updated_at from push_device where firebase_uid = ${firebaseUid}`;
  return rows[0] ?? null;
}

export type Registered = Pick<Device, "firebase_uid" | "display_name" | "updated_at">;
/** Registered users for the send picker. No token column is selected. */
export async function listRegistered(): Promise<Registered[]> {
  return reader()<Registered[]>`select firebase_uid, display_name, updated_at from push_device order by updated_at desc limit 100`;
}
