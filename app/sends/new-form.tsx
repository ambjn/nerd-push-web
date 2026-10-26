"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, buttonSecondary, field, hint, label } from "@/components/ui";

type V = { id: string; version: number; title_template: string; body_template: string; route_key: string };

export function NewSendForm({ versions }: { versions: V[] }) {
  const router = useRouter();
  const [key] = useState(() => crypto.randomUUID());
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  function body(form: HTMLFormElement) {
    const f = Object.fromEntries(new FormData(form));
    return { firebaseUid: f.firebaseUid, creativeVersionId: f.creativeVersionId, idempotencyKey: key, scheduledAt: f.scheduledAt ? new Date(String(f.scheduledAt)).toISOString() : null };
  }
  async function onPreview(e: React.MouseEvent<HTMLButtonElement>) {
    try { setPreview(JSON.stringify(await api("/api/sends/preview", { method: "POST", body: JSON.stringify(body(e.currentTarget.form!)) }), null, 2)); }
    catch (err) { setPreview((err as Error).message); }
  }
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    try { const s = await api<{ id: string }>("/api/sends", { method: "POST", body: JSON.stringify(body(e.currentTarget)) }); router.push(`/sends/${s.id}`); }
    catch (err) { setMsg((err as Error).message); }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className={label}><span className={hint}>Target Firebase UID (exactly one)</span><input name="firebaseUid" required maxLength={128} className={field} /></label>
      <label className={label}><span className={hint}>Approved creative version</span>
        <select name="creativeVersionId" required className={field}>
          {versions.length === 0 && <option value="">No approved versions</option>}
          {versions.map((v) => <option key={v.id} value={v.id}>v{v.version} · {v.title_template} → {v.route_key}</option>)}
        </select>
      </label>
      <label className={label}><span className={hint}>Schedule (optional, local time)</span><input name="scheduledAt" type="datetime-local" className={field} /></label>
      <p className="font-mono text-xs text-zinc-500">idempotency key {key}</p>
      {preview && <pre className="overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">{preview}</pre>}
      {msg && <p role="alert" className="text-sm text-red-600">{msg}</p>}
      <div className="flex gap-3">
        <button type="button" className={buttonSecondary} onClick={onPreview}>Preview (no side effects)</button>
        <button className={button} disabled={versions.length === 0}>Enqueue one send</button>
      </div>
    </form>
  );
}
