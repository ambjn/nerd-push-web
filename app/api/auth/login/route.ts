import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { email?: unknown; password?: unknown } | null;
  if (typeof b?.email !== "string" || typeof b?.password !== "string") return Response.json({ error: "bad_request" }, { status: 400 });
  const supabase = createClient(await cookies());
  const { error } = await supabase.auth.signInWithPassword({ email: b.email, password: b.password });
  if (error) return Response.json({ error: "invalid_credentials" }, { status: 401 });
  return Response.json({ ok: true });
}
