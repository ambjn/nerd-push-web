"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, field } from "./creatives/ui";
import type { Registered } from "@/lib/reader";
import { Spinner } from "./spinner";

export function SendForm({ registered, versions }: { registered: Registered[]; versions: { id: string; creativeId: string; label: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const v = versions.find((x) => x.id === f.versionId);
    if (!v) return;
    setBusy(true); setMsg(null);
    try {
      const r = await api<{ status: string; error: string | null; provider: string }>(`/api/push-creatives/${v.creativeId}/test-send`, { firebaseUid: f.firebaseUid, versionId: v.id });
      setMsg(r.status === "accepted" ? `Accepted by ${r.provider}${r.provider === "mock" ? " (mock: not delivered)" : ". Check the phone."}` : `${r.status}${r.error ? `: ${r.error}` : ""}`);
      router.refresh();
    } catch (err) { setMsg(`Failed: ${(err as Error).message}`); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <select name="firebaseUid" required className={field}>
        <option value="">{registered.length ? "Device" : "No registered devices yet"}</option>
        {registered.map((r) => <option key={r.firebase_uid} value={r.firebase_uid}>{r.display_name ?? r.firebase_uid}</option>)}
      </select>
      <select name="versionId" required className={field}>
        <option value="">{versions.length ? "Approved creative" : "No approved creative"}</option>
        {versions.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
      </select>
      <button className={`${button} inline-flex items-center justify-center gap-2`} disabled={busy || !registered.length || !versions.length}>{busy && <Spinner />}{busy ? "Sending…" : "Send"}</button>
      {msg && <p role="status" className="text-sm sm:col-span-3">{msg}</p>}
    </form>
  );
}
