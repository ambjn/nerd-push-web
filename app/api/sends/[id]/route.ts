import { requireRole } from "@/lib/control/auth";
import { getSendDetail } from "@/lib/control/sends";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  const detail = await getSendDetail((await params).id);
  if (!detail) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(detail);
}
