import { verifyFirebaseUid } from "@/lib/firebase";
import { revokeDevice } from "@/lib/app-source/write";

export async function POST(req: Request) {
  const uid = await verifyFirebaseUid(req.headers.get("authorization"));
  if (!uid) return Response.json({ error: "unauthenticated" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { installationId?: unknown } | null;
  if (typeof b?.installationId !== "string" || b.installationId.length < 8 || b.installationId.length > 128) {
    return Response.json({ error: "bad_installation_id" }, { status: 400 });
  }
  try {
    await revokeDevice(uid, b.installationId, "android");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "source_write_failed" }, { status: 502 });
  }
}
