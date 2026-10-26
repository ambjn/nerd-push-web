import { verifyFirebaseUid } from "@/lib/firebase";
import { db } from "@/lib/db";

/** Android calls this with its Firebase ID token. The UID comes from the token, never from the body. */
export async function POST(req: Request) {
  const uid = await verifyFirebaseUid(req.headers.get("authorization"));
  if (!uid) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { token?: unknown; displayName?: unknown; marketingChoice?: unknown } | null;
  if (typeof b?.token !== "string" || b.token.length < 16 || b.token.length > 4096) return Response.json({ error: "bad_token" }, { status: 400 });
  const { error } = await db().from("push_device").upsert({ firebase_uid: uid, token: b.token, display_name: typeof b.displayName === "string" ? b.displayName.slice(0, 200) : null, marketing_choice: b.marketingChoice === "opted_in" || b.marketingChoice === "opted_out" ? b.marketingChoice : null, updated_at: new Date().toISOString() });
  if (error) return Response.json({ error: "db_error" }, { status: 500 });
  return Response.json({ ok: true });
}
