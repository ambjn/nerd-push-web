"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, buttonSecondary, field, hint, label } from "@/components/ui";
import type { Creative } from "@/lib/control/db";
import { LIMITS, ROUTE_KEYS } from "@/lib/push/creative";

export function CreativeEditor({ creative, lint, canApprove }: { creative: Creative; lint: string[]; canApprove: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const draft = creative.status === "draft";

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const patch = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(`/api/creatives/${creative.id}`, { method: "PATCH", body: JSON.stringify({ row_version: creative.row_version, patch }) });
      setMsg("Saved"); router.refresh();
    } catch (err) { setMsg((err as Error).message); }
  }
  async function approve() {
    try {
      const r = await api<{ versionId: string }>(`/api/creatives/${creative.id}/approve`, { method: "POST", body: JSON.stringify({ row_version: creative.row_version }) });
      setMsg(`Approved as version ${r.versionId}`); router.refresh();
    } catch (err) { setMsg((err as Error).message); }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <label className={label}><span className={hint}>Label</span><input name="label" defaultValue={creative.label} disabled={!draft} maxLength={80} className={field} /></label>
      <label className={label}><span className={hint}>Title</span><input name="title_template" defaultValue={creative.title_template} disabled={!draft} maxLength={LIMITS.title} className={field} /></label>
      <label className={label}><span className={hint}>Body</span><textarea name="body_template" defaultValue={creative.body_template} disabled={!draft} rows={4} maxLength={LIMITS.body} className={field} /></label>
      <label className={label}><span className={hint}>Route</span>
        <select name="route_key" defaultValue={creative.route_key} disabled={!draft} className={field}>{ROUTE_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      </label>
      {lint.length > 0 && <p className="text-sm text-amber-600">Lint: {lint.join(", ")}</p>}
      {msg && <p role="status" className="text-sm">{msg}</p>}
      <div className="flex gap-3">
        <button className={button} disabled={!draft}>Save draft</button>
        <button type="button" className={buttonSecondary} disabled={!draft || !canApprove || lint.length > 0} onClick={approve}>Approve (freeze version)</button>
      </div>
    </form>
  );
}
