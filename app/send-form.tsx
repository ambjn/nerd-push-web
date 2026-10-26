"use client";
import { useState } from "react";

const field = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export function SendForm({ devices }: { devices: { firebase_uid: string; display_name: string | null; updated_at: string }[] }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    const j = await res.json();
    setMsg(res.ok ? `Sent: ${j.messageName}` : `Failed: ${j.error}`);
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm"><span>Device</span>
        <select name="firebaseUid" required className={field}>
          {devices.length === 0 && <option value="">No registered devices yet</option>}
          {devices.map((d) => <option key={d.firebase_uid} value={d.firebase_uid}>{d.display_name ?? d.firebase_uid} · {new Date(d.updated_at).toLocaleString()}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm"><span>Title</span><input name="title" required maxLength={120} className={field} /></label>
      <label className="flex flex-col gap-1 text-sm"><span>Body</span><textarea name="body" required maxLength={500} rows={4} className={field} /></label>
      <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900" disabled={devices.length === 0}>Send notification</button>
      {msg && <p role="status" className="text-sm">{msg}</p>}
    </form>
  );
}
