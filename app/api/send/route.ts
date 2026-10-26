import { currentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendPush } from "@/lib/firebase";

/** Dashboard send: one registered user, one title, one body. */
export async function POST(req: Request) {
  if (!(await currentUser())) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { firebaseUid?: unknown; title?: unknown; body?: unknown } | null;
  if (typeof b?.firebaseUid !== "string" || typeof b.title !== "string" || typeof b.body !== "string" || !b.title.trim() || !b.body.trim() || b.title.length > 120 || b.body.length > 500) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const { data: device } = await db().from("push_device").select("token").eq("firebase_uid", b.firebaseUid).maybeSingle();
  if (!device) return Response.json({ error: "no_device" }, { status: 404 });
  try {
    const messageName = await sendPush(device.token, b.title.trim(), b.body.trim());
    return Response.json({ ok: true, messageName });
  } catch (e) {
    return Response.json({ error: (e as { code?: string }).code ?? "send_failed" }, { status: 502 });
  }
}
