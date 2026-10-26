import { verifyFirebaseUid } from "@/lib/firebase";
import { parseRegisterBody, registerDevice } from "@/lib/app-source/write";

export async function POST(req: Request) {
  const uid = await verifyFirebaseUid(req.headers.get("authorization"));
  if (!uid) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (Number(req.headers.get("content-length") ?? 0) > 8192) return Response.json({ error: "too_large" }, { status: 413 });
  const body = parseRegisterBody(await req.json().catch(() => null));
  if ("error" in body) return Response.json(body, { status: 400 });
  try {
    const deviceId = await registerDevice(uid, body); // UID comes from the verified token, never the body
    return Response.json({ deviceId });
  } catch (e) {
    const msg = (e as Error).message;
    if (msg === "invalid_timezone") return Response.json({ error: msg }, { status: 400 });
    return Response.json({ error: "source_write_failed" }, { status: 502 });
  }
}
