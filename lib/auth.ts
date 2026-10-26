import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

/** Signed-in dashboard user (Supabase Auth), or null. */
export async function currentUser() {
  const { data: { user } } = await createClient(await cookies()).auth.getUser();
  return user;
}
