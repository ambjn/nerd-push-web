import Link from "next/link";
import { listCreatives } from "@/lib/control/creatives";
import { currentOperator } from "@/lib/control/auth";
import { card } from "@/components/ui";
import { NewCreativeForm } from "./new-form";

export default async function Creatives() {
  const op = await currentOperator();
  if (!op) return <p>No operator access.</p>;
  const creatives = await listCreatives();
  return (
    <>
      <header><h2 className="text-2xl font-semibold tracking-tight">Creatives</h2></header>
      <section className={card}><h3 className="mb-4 font-medium">New draft</h3><NewCreativeForm /></section>
      <section className={card}>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500"><tr><th className="pb-2 font-normal">Label</th><th className="pb-2 font-normal">Title</th><th className="pb-2 font-normal">Route</th><th className="pb-2 font-normal">Status</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {creatives.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-zinc-500">No creatives yet.</td></tr>}
            {creatives.map((c) => (
              <tr key={c.id}>
                <td className="py-2"><Link href={`/creatives/${c.id}`} className="underline">{c.label}</Link></td>
                <td className="py-2">{c.title_template}</td>
                <td className="py-2 font-mono text-xs">{c.route_key}</td>
                <td className="py-2">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
