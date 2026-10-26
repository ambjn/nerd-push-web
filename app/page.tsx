import Link from "next/link";
import { connection } from "next/server";
import { listCreatives } from "@/lib/creatives";
import { db } from "@/lib/db";
import { providerName } from "@/lib/push/provider";
import { NewCreativeForm } from "./push/new-form";

export default async function Home() {
  await connection();
  const [creatives, { count }] = await Promise.all([listCreatives(), db().from("push_device").select("*", { count: "exact", head: true })]);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <div><h1 className="text-xl font-semibold">Nerd Push</h1><p className="text-sm text-zinc-500">{count ?? 0} registered device(s) · provider {providerName()}</p></div>
      </header>
      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"><h2 className="mb-3 font-medium">New creative</h2><NewCreativeForm /></section>
      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Creatives</h2>
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {creatives.length === 0 && <li className="py-4 text-zinc-500">None yet.</li>}
          {creatives.map((c) => <li key={c.id} className="flex justify-between py-2"><Link href={`/push/${c.id}`} className="underline">{c.label}</Link><span className="text-zinc-500">{c.message_class} → {c.route} · {c.status}</span></li>)}
        </ul>
      </section>
    </main>
  );
}
