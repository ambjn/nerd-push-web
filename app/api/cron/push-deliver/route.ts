import { randomUUID } from "node:crypto";
import { controlDb } from "@/lib/control/db";
import { supabaseWorkerDeps } from "@/lib/control/worker-deps";
import { selectProvider } from "@/lib/push/provider-select";
import { runWorker } from "@/lib/push/worker";

export const maxDuration = 60;

/** Scheduler-only. Lease, recover stale claims, run one bounded batch, settle, release lease. */
export async function POST(req: Request) {
  const secret = process.env.PUSH_CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer /, "") ?? req.headers.get("x-cron-secret");
  if (!secret || given !== secret) return Response.json({ error: "unauthenticated" }, { status: 401 });

  const provider = selectProvider();
  if ("disabled" in provider) return Response.json({ ran: false, reason: provider.reason, note: "pending sends stay pending" }, { status: 200 });

  const db = controlDb();
  const owner = `worker-${randomUUID()}`;
  const lease = await db.rpc("acquire_worker_lease", { p_key: "push-deliver", p_owner: owner, p_ttl: "2 minutes" });
  if (lease.error) return Response.json({ error: lease.error.message }, { status: 500 });
  if (!lease.data) return Response.json({ ran: false, reason: "lease_held" }, { status: 200 });

  const run = await db.from("worker_run").insert({ owner }).select("id").single();
  try {
    const recovered = await db.rpc("recover_stale_push_claims", { p_stale: "10 minutes" });
    const report = await runWorker(supabaseWorkerDeps, provider, { owner, limit: Number(process.env.PUSH_BATCH_SIZE ?? 10) });
    await db.from("worker_run").update({ finished_at: new Date().toISOString(), status: report.errors.length ? "error" : "ok", claimed: report.claimed, settled: report.settled, errors: report.errors }).eq("id", run.data?.id);
    return Response.json({ ran: true, provider: provider.name, recovered: recovered.data, ...report });
  } catch (e) {
    await db.from("worker_run").update({ finished_at: new Date().toISOString(), status: "error", errors: [{ error: (e as Error).message.slice(0, 200) }] }).eq("id", run.data?.id);
    return Response.json({ ran: true, error: "worker_failed" }, { status: 500 });
  } finally {
    await db.rpc("release_worker_lease", { p_key: "push-deliver", p_owner: owner });
  }
}
