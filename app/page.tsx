import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { db, type Device } from "@/lib/db";
import { SendForm } from "./send-form";

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { data } = await db().from("push_device").select("firebase_uid,display_name,updated_at").order("updated_at", { ascending: false });
  const devices = (data ?? []) as Omit<Device, "token">[];
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Nerd Push</h1>
        <form action="/api/auth/logout" method="post"><button className="text-sm underline">Sign out</button></form>
      </header>
      <SendForm devices={devices} />
    </main>
  );
}
