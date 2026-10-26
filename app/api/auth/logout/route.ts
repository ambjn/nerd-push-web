import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
  await createClient(await cookies()).auth.signOut();
  return Response.json({ ok: true });
}
