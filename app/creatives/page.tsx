import Link from "next/link";
import { connection } from "next/server";
import { listCreatives } from "@/lib/creatives";
import { NewCreativeForm } from "./new-form";

const card = "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

export default async function Creatives() {
  await connection();
  const creatives = await listCreatives();
  return (
    <>
      <section className={card}><h1 className="mb-3 text-lg font-semibold">New creative</h1><NewCreativeForm /></section>
      <section className={card}>
        <h2 className="mb-3 font-medium">Creatives</h2>
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {creatives.length === 0 && <li className="py-4 text-zinc-500">None yet.</li>}
          {creatives.map((c) => <li key={c.id} className="flex justify-between py-2"><Link href={`/creatives/${c.id}`} className="underline">{c.label} — {c.title}</Link><span className="text-zinc-500">{c.route} · {c.status}</span></li>)}
        </ul>
      </section>
    </>
  );
}
