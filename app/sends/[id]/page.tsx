import { notFound } from "next/navigation";
import { currentOperator } from "@/lib/control/auth";
import { getSendDetail } from "@/lib/control/sends";
import { card } from "@/components/ui";

export default async function SendPage({ params }: { params: Promise<{ id: string }> }) {
  const op = await currentOperator();
  if (!op) return <p>No operator access.</p>;
  const detail = await getSendDetail((await params).id);
  if (!detail) notFound();
  const { send, attempts, taps } = detail;
  const rows: [string, string | null][] = [
    ["Status", send.status === "accepted" ? "accepted by provider (not proof of display)" : send.status],
    ["Target UID", send.firebase_uid], ["Version", send.creative_version_id], ["Idempotency key", send.idempotency_key],
    ["Scheduled", send.scheduled_at], ["Reserved (permit)", send.reserved_at], ["Provider attempted", send.provider_attempted_at],
    ["Provider accepted", send.provider_accepted_at], ["Finished", send.finished_at], ["Error", send.error_code], ["Retries", String(send.retry_count)],
  ];
  return (
    <>
      <header><h2 className="text-2xl font-semibold tracking-tight">Send {send.id.slice(0, 8)}</h2></header>
      <section className={card}>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          {rows.map(([k, v]) => <><dt key={k} className="text-zinc-500">{k}</dt><dd key={k + "v"} className="font-mono text-xs">{v ?? "—"}</dd></>)}
        </dl>
        {send.rendered_snapshot != null && <pre className="mt-4 overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">{JSON.stringify(send.rendered_snapshot, null, 2)}</pre>}
      </section>
      <section className={card}>
        <h3 className="mb-2 font-medium">Per-device attempts</h3>
        {attempts.length === 0 && <p className="text-sm text-zinc-500">No provider attempt recorded.</p>}
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {attempts.map((a) => <li key={a.id} className="py-2 font-mono text-xs">device {a.device_id.slice(0, 8)} #{a.attempt_no} {a.provider} → {a.outcome ?? "unsettled"} {a.error_code ?? ""} {a.provider_message_id ?? ""}</li>)}
        </ul>
      </section>
      <section className={card}>
        <h3 className="mb-2 font-medium">Taps (authenticated opens)</h3>
        {taps.length === 0 && <p className="text-sm text-zinc-500">None reported.</p>}
        <ul className="text-sm">{taps.map((t) => <li key={t.id} className="font-mono text-xs">{t.opened_at} event {t.event_id.slice(0, 8)}</li>)}</ul>
      </section>
    </>
  );
}
