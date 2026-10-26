import Link from "next/link";
import { connection } from "next/server";
import { listApprovedVersions, listTestSends } from "@/lib/creatives";
import { providerName } from "@/lib/push/provider";
import { listRegistered } from "@/lib/reader";
import { SendForm } from "./send-form";

const card = "rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900";

export default async function SendPage() {
  await connection();
  const [registered, versions, sends] = await Promise.all([listRegistered().catch(() => []), listApprovedVersions(), listTestSends()]);
  const provider = providerName();
  return (
    <>
      <section className={card}>
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-lg font-semibold">Send a notification</h1>
          <span className={`text-xs ${provider === "fcm" ? "text-emerald-600" : "text-amber-600"}`}>{provider === "fcm" ? "live: FCM" : "mock provider: nothing reaches the phone until FIREBASE_SERVICE_ACCOUNT_JSON is set"}</span>
        </div>
        {versions.length === 0 && <p className="mb-3 text-sm text-zinc-500">No approved creative yet. <Link href="/creatives" className="underline">Create and approve one</Link>.</p>}
        <SendForm registered={registered} versions={versions.map((v) => ({ id: v.id, creativeId: v.creative_id, label: `${v.label} v${v.version} — ${v.title} → ${v.route}` }))} />
      </section>
      <section className={card}>
        <h2 className="mb-3 font-medium">Recent sends</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-zinc-500"><tr><th className="pb-2 font-normal">When</th><th className="pb-2 font-normal">To</th><th className="pb-2 font-normal">Title</th><th className="pb-2 font-normal">Result</th></tr></thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {sends.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-zinc-500">Nothing sent yet.</td></tr>}
            {sends.map((s) => <tr key={s.id}><td className="py-2 text-zinc-500">{new Date(s.created_at).toLocaleString()}</td><td className="py-2 font-mono text-xs">{s.firebase_uid.slice(0, 10)}…</td><td className="py-2">{s.title}</td><td className="py-2">{s.provider} · {s.status === "accepted" ? "accepted by provider" : s.status}{s.error_code ? ` (${s.error_code})` : ""}</td></tr>)}
          </tbody>
        </table>
      </section>
    </>
  );
}
