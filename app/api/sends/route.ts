import { requireRole } from "@/lib/control/auth";
import { enqueueSend, listSends, parseEnqueueBody } from "@/lib/control/sends";

export async function GET(req: Request) {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  const cursor = new URL(req.url).searchParams.get("cursor");
  return Response.json(await listSends(cursor));
}

/** Sender role. One Firebase UID, one approved version, idempotent on key. Enqueue only; no provider call. */
export async function POST(req: Request) {
  const op = await requireRole("sender");
  if (op instanceof Response) return op;
  const input = parseEnqueueBody(await req.json().catch(() => null));
  if ("error" in input) return Response.json(input, { status: 400 });
  try {
    const send = await enqueueSend(input, op.userId);
    return Response.json(send, { status: send.requested_by === op.userId && Date.now() - Date.parse(send.requested_at) < 5000 ? 201 : 200 });
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: msg }, { status: msg === "version_not_found" ? 404 : 500 });
  }
}
