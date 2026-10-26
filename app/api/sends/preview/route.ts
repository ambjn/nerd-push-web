import { requireRole } from "@/lib/control/auth";
import { controlDb, type CreativeVersion } from "@/lib/control/db";
import { readSourceState } from "@/lib/app-source/read";
import { evaluateEligibility } from "@/lib/push/policy";
import { render } from "@/lib/push/creative";

/** Read-only: exact render plus eligibility for one UID and one approved version. No ledger row, no provider. */
export async function POST(req: Request) {
  const op = await requireRole("sender");
  if (op instanceof Response) return op;
  const b = (await req.json().catch(() => null)) as { firebaseUid?: unknown; creativeVersionId?: unknown } | null;
  if (typeof b?.firebaseUid !== "string" || typeof b?.creativeVersionId !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  const { data: v } = await controlDb().from("push_creative_version").select("*").eq("id", b.creativeVersionId).maybeSingle();
  if (!v) return Response.json({ error: "version_not_found" }, { status: 404 });
  let source;
  try { source = await readSourceState(b.firebaseUid); } catch { return Response.json({ error: "source_unavailable" }, { status: 502 }); }
  const { data: allow } = await controlDb().from("push_allowlist").select("enabled").eq("firebase_uid", b.firebaseUid).maybeSingle();
  const version = v as CreativeVersion;
  const eligibility = evaluateEligibility({ source, allowlisted: allow?.enabled === true, messageClass: version.message_class, now: new Date(), sentLast24h: 0, sentLast7d: 0 });
  const rendered = render(version, { display_name: null });
  return Response.json({ rendered, eligibility, devices: source.devices.length, note: "preview only; counts against no cap; caps are evaluated at reservation" });
}
