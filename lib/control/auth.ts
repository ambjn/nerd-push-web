import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { controlDb, type Role } from "./db";

export type Operator = { userId: string; email: string | null; role: Role };
const RANK: Record<Role, number> = { editor: 1, sender: 2, admin: 3 };

/** B staff session joined to an active np.operator row. Null when either is missing. */
export async function currentOperator(): Promise<Operator | null> {
  const supabase = createClient(await cookies());
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await controlDb().from("operator").select("role,active").eq("auth_user_id", user.id).maybeSingle();
  if (!data?.active) return null;
  return { userId: user.id, email: user.email ?? null, role: data.role as Role };
}

/** Route guard. Returns the operator or a ready-made 401/403 response. */
export async function requireRole(min: Role): Promise<Operator | Response> {
  const op = await currentOperator();
  if (!op) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (RANK[op.role] < RANK[min]) return Response.json({ error: "forbidden" }, { status: 403 });
  return op;
}
