import Link from "next/link";
import { currentOperator } from "@/lib/control/auth";
import { card } from "@/components/ui";

export default async function Home() {
  const op = await currentOperator();
  if (!op) {
    return (
      <div className={card}>
        <p>Signed in, but no active operator row. Ask an admin to run <code>np.bootstrap_operator</code> for your email.</p>
      </div>
    );
  }
  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Overview</h2>
        <p className="text-sm text-zinc-500">Staging only. One target, one approved creative, one send at a time.</p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2">
        <Link href="/creatives" className={card}><h3 className="font-medium">Creatives</h3><p className="text-sm text-zinc-500">Draft, lint, approve immutable versions.</p></Link>
        <Link href="/sends" className={card}><h3 className="font-medium">Sends</h3><p className="text-sm text-zinc-500">Preview, enqueue, inspect per-device outcomes.</p></Link>
      </section>
      <p className="text-xs text-zinc-500">Provider acceptance is labelled “accepted by FCM”. It is never proof of a banner on the phone.</p>
    </>
  );
}
