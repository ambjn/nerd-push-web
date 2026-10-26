"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, field, hint, label } from "@/components/ui";
import { LIMITS, ROUTE_KEYS } from "@/lib/push/creative";

export function NewCreativeForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    try {
      const r = await api<{ creative: { id: string } }>("/api/creatives", { method: "POST", body: JSON.stringify({ ...f, message_class: "transactional" }) });
      router.push(`/creatives/${r.creative.id}`);
    } catch (err) { setError((err as Error).message); }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className={label}><span className={hint}>Label</span><input name="label" required maxLength={80} className={field} /></label>
      <label className={label}><span className={hint}>Title (max {LIMITS.title}; {"{{display_name}}"} allowed)</span><input name="title_template" required maxLength={LIMITS.title} className={field} /></label>
      <label className={label}><span className={hint}>Body (max {LIMITS.body})</span><textarea name="body_template" required rows={4} maxLength={LIMITS.body} className={field} /></label>
      <label className={label}><span className={hint}>Route</span>
        <select name="route_key" className={field}>{ROUTE_KEYS.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <div><button className={button}>Create draft</button></div>
    </form>
  );
}
