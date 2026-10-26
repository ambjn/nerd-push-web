"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, buttonSecondary, field } from "@/components/ui";

export function AllowlistForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try { await api("/api/allowlist", { method: "POST", body: JSON.stringify({ ...f, enabled: f.enabled === "on" }) }); setMsg("Saved"); router.refresh(); }
    catch (err) { setMsg((err as Error).message); }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1"><span>Exact Firebase UID</span><input name="firebaseUid" required className={field} /></label>
      <label className="flex flex-col gap-1"><span>Reason</span><input name="reason" required maxLength={200} className={field} /></label>
      <label className="flex items-center gap-2"><input name="enabled" type="checkbox" defaultChecked /> enabled</label>
      <button className={buttonSecondary}>Upsert</button>
      {msg && <span role="status">{msg}</span>}
    </form>
  );
}
