import postgres from "postgres";
import type { Device } from "./db";

/** Read-only bridge to the registered (logged-in) users: role nerdpush_reader can only SELECT push_device. */
function reader() {
  const url = process.env.SUPABASE_READONLY_URL;
  if (!url) throw new Error("SUPABASE_READONLY_URL missing");
  return postgres(url, { prepare: false, max: 1, ssl: "require" });
}

/** Current device for one Firebase UID; the token stays in server memory only. */
export async function readDevice(firebaseUid: string): Promise<Device | null> {
  const sql = reader();
  try {
    const rows = await sql<Device[]>`select firebase_uid, display_name, token, marketing_choice, updated_at from push_device where firebase_uid = ${firebaseUid}`;
    return rows[0] ?? null;
  } finally { await sql.end(); }
}

/** Registered users for the test-send picker. No token column is selected. */
export async function listRegistered(): Promise<Pick<Device, "firebase_uid" | "display_name" | "updated_at">[]> {
  const sql = reader();
  try {
    return await sql<Pick<Device, "firebase_uid" | "display_name" | "updated_at">[]>`select firebase_uid, display_name, updated_at from push_device order by updated_at desc limit 100`;
  } finally { await sql.end(); }
}
