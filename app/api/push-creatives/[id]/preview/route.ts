import { getCreative } from "@/lib/creatives";
import { bytes, lintCreative } from "@/lib/push/creative";
import { buildFcmMessage, validateFcmMessage } from "@/lib/push/payload";

/** Read-only exact render, lint, byte counters and payload checks. No ledger row, no provider. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getCreative((await params).id);
  if (!c) return Response.json({ error: "not_found" }, { status: 404 });
  const payload = buildFcmMessage("<device token>", { eventId: "00000000-0000-4000-8000-000000000000", targetUserId: "<firebase uid>", title: c.title, body: c.body, notificationType: c.notification_type, route: c.route, webUrl: c.web_url });
  return Response.json({ lint: lintCreative(c), bytes: { title: bytes(c.title), body: bytes(c.body) }, payload_checks: validateFcmMessage(payload), payload });
}
