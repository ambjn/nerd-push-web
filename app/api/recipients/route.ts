import { requireRole } from "@/lib/control/auth";
import { lookupRecipient } from "@/lib/app-source/read";
import { controlDb } from "@/lib/control/db";

/** Sender role. Exact Firebase UID lookup against A; devices are returned without tokens. */
export async function GET(req: Request) {
  const op = await requireRole("sender");
  if (op instanceof Response) return op;
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 128) return Response.json({ error: "bad_query" }, { status: 400 });
  try {
    const [devices, allow] = await Promise.all([lookupRecipient(q), controlDb().from("push_allowlist").select("enabled").eq("firebase_uid", q).maybeSingle()]);
    return Response.json({ firebaseUid: q, devices, allowlisted: allow.data?.enabled === true });
  } catch {
    return Response.json({ error: "source_unavailable" }, { status: 502 });
  }
}
