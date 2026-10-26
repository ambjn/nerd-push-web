import { requireRole } from "@/lib/control/auth";
import { createCreative, listCreatives, parseCreativeInput, type CreativeInput } from "@/lib/control/creatives";

export async function GET() {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  return Response.json(await listCreatives());
}

export async function POST(req: Request) {
  const op = await requireRole("editor");
  if (op instanceof Response) return op;
  const input = parseCreativeInput(await req.json().catch(() => null));
  if ("error" in input) return Response.json(input, { status: 400 });
  return Response.json(await createCreative(op.userId, input as CreativeInput), { status: 201 });
}
