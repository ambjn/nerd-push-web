import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getCreative, listVersions } from "@/lib/creatives";
import { bytes, lintCreative } from "@/lib/push/creative";
import { Editor } from "./editor";

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const creative = await getCreative(id);
  if (!creative) notFound();
  const versions = await listVersions(id);
  return (
    <div className="flex flex-col gap-6">
      <header><Link href="/creatives" className="text-sm underline">← Creatives</Link><h1 className="text-xl font-semibold">{creative.label}</h1><p className="text-sm text-zinc-500">{creative.status} · row_version {creative.row_version} · {creative.notification_type}</p></header>
      <Editor creative={creative} lint={lintCreative(creative)} titleBytes={bytes(creative.title)} bodyBytes={bytes(creative.body)} versions={versions} />
    </div>
  );
}
