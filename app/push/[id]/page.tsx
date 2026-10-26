import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { getCreative, listVersions } from "@/lib/creatives";
import { bytes, lintCreative } from "@/lib/push/creative";
import { listRegistered } from "@/lib/reader";
import { Editor } from "./editor";

export default async function CreativePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await currentUser())) redirect("/login");
  const { id } = await params;
  const creative = await getCreative(id);
  if (!creative) notFound();
  const [versions, registered] = await Promise.all([listVersions(id), listRegistered().catch(() => null)]);
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-6">
      <header><Link href="/" className="text-sm underline">← Creatives</Link><h1 className="text-xl font-semibold">{creative.label}</h1><p className="text-sm text-zinc-500">{creative.status} · row_version {creative.row_version} · {creative.notification_type}</p></header>
      <Editor creative={creative} lint={lintCreative(creative)} titleBytes={bytes(creative.title)} bodyBytes={bytes(creative.body)} versions={versions} registered={registered} />
    </main>
  );
}
