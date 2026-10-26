import { currentOperator } from "@/lib/control/auth";

export async function GET() {
  const op = await currentOperator();
  if (!op) return Response.json({ error: "unauthenticated" }, { status: 401 });
  return Response.json(op);
}
