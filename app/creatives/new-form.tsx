"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, field } from "./ui";
import { IMPLEMENTED_ROUTES, ROUTE_KEYS } from "@/lib/push/routes";

export function NewCreativeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try { const r = await api<{ creative: { id: string } }>("/api/push-creatives", { ...f, web_url: f.web_url || null }); router.push(`/creatives/${r.creative.id}`); }
    catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3 text-sm">
      <input name="label" placeholder="Label" required maxLength={120} className={field} />
      <input name="title" placeholder="Title (≤120 bytes)" required className={field} />
      <textarea name="body" placeholder="Body (≤500 bytes)" required rows={3} className={field} />
      <div className="grid gap-3 sm:grid-cols-3">
        <select name="message_class" className={field}><option value="transactional">transactional</option><option value="marketing">marketing</option></select>
        <select name="route" className={field}>{ROUTE_KEYS.map((r) => <option key={r} value={r} disabled={!IMPLEMENTED_ROUTES.has(r)}>{r}</option>)}</select>
        <input name="web_url" type="url" placeholder="https:// link (optional)" className={field} />
      </div>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      <div><button className={button}>Create draft</button></div>
    </form>
  );
}
