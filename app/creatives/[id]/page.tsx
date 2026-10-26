import { notFound } from "next/navigation";
import { getCreative } from "@/lib/control/creatives";
import { controlDb, type CreativeVersion } from "@/lib/control/db";
import { currentOperator } from "@/lib/control/auth";
import { lintCreative } from "@/lib/push/creative";
import { card } from "@/components/ui";
import { CreativeEditor } from "./editor";

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  const op = await currentOperator();
  if (!op) return <p>No operator access.</p>;
  const { id } = await params;
  const creative = await getCreative(id);
  if (!creative) notFound();
  const { data } = await controlDb().from("push_creative_version").select("*").eq("creative_id", id).order("version", { ascending: false });
  const versions = (data ?? []) as CreativeVersion[];
  return (
    <>
      <header>
        <h2 className="text-2xl font-semibold tracking-tight">{creative.label}</h2>
        <p className="text-sm text-zinc-500">status {creative.status} · row_version {creative.row_version}</p>
      </header>
      <section className={card}>
        <CreativeEditor creative={creative} lint={lintCreative(creative)} canApprove={op.role !== "editor"} />
      </section>
      <section className={card}>
        <h3 className="mb-2 font-medium">Approved versions</h3>
        {versions.length === 0 && <p className="text-sm text-zinc-500">None. Versions are immutable once approved.</p>}
        <ul className="divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
          {versions.map((v) => (
            <li key={v.id} className="py-2">
              <p>v{v.version} · <span className="font-mono text-xs">{v.id}</span></p>
              <p className="text-zinc-500">{v.title_template} — {v.body_template}</p>
              <p className="font-mono text-xs text-zinc-500">sha256 {v.artifact_sha256}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
