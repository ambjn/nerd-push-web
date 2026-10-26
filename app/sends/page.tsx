import Link from "next/link";
import { currentOperator } from "@/lib/control/auth";
import { listAllowlist, listApprovedVersions, listSends } from "@/lib/control/sends";
import { card } from "@/components/ui";
import { NewSendForm } from "./new-form";
import { AllowlistForm } from "./allowlist-form";

export default async function Sends() {
  const op = await currentOperator();
  if (!op) return <p>No operator access.</p>;
  const [sends, versions, allowlist] = await Promise.all([listSends(null), listApprovedVersions(), listAllowlist()]);
  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">Sends</h2>
        <p className="text-sm text-zinc-500">Provider: {process.env.PUSH_PROVIDER ?? "mock"}. “accepted” means accepted by the provider, not shown on the phone.</p>
      </header>
      <section className={card}>
        <h3 className="mb-4 font-medium">Allowlist ({allowlist.filter((a) => a.enabled).length} enabled)</h3>
        <ul className="mb-4 text-sm">
          {allowlist.length === 0 && <li className="text-zinc-500">Empty. No live recipient exists until an admin adds one exact UID.</li>}
          {allowlist.map((a) => <li key={a.firebase_uid} className="font-mono text-xs">{a.enabled ? "✓" : "✗"} {a.firebase_uid} <span className="font-sans text-zinc-500">{a.reason}</span></li>)}
        </ul>
        {op.role === "admin" && <AllowlistForm />}
      </section>
      {op.role !== "editor" && (
        <section className={card}><h3 className="mb-4 font-medium">New send</h3><NewSendForm versions={versions ?? []} /></section>
      )}
      <section className={card}>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500"><tr><th className="pb-2 font-normal">Send</th><th className="pb-2 font-normal">Target UID</th><th className="pb-2 font-normal">Status</th><th className="pb-2 font-normal">Error</th><th className="pb-2 text-right font-normal">Requested</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sends.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-zinc-500">No sends yet.</td></tr>}
            {sends.map((s) => (
              <tr key={s.id}>
                <td className="py-2"><Link href={`/sends/${s.id}`} className="font-mono text-xs underline">{s.id.slice(0, 8)}</Link></td>
                <td className="py-2 font-mono text-xs">{s.firebase_uid}</td>
                <td className="py-2">{s.status === "accepted" ? "accepted by provider" : s.status}</td>
                <td className="py-2 text-zinc-500">{s.error_code ?? ""}</td>
                <td className="py-2 text-right text-zinc-500">{new Date(s.requested_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
