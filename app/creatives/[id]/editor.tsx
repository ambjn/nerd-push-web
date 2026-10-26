"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, field, secondary } from "../ui";
import type { Creative, CreativeVersion } from "@/lib/creatives";
import { LIMITS } from "@/lib/push/creative";
import { IMPLEMENTED_ROUTES, ROUTE_KEYS } from "@/lib/push/routes";
import { Spinner } from "@/app/spinner";

export function Editor({ creative, lint, titleBytes, bodyBytes, versions }: { creative: Creative; lint: string[]; titleBytes: number; bodyBytes: number; versions: CreativeVersion[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(creative.title);
  const [body, setBody] = useState(creative.body);
  const [msg, setMsg] = useState<string | null>(null);
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const draft = creative.status === "draft";
  const call = async (fn: () => Promise<unknown>, ok: string) => { setBusy(true); try { const r = await fn(); setMsg(ok); setOut(r ? JSON.stringify(r, null, 2) : null); router.refresh(); } catch (e) { setMsg((e as Error).message); } finally { setBusy(false); } };

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    await call(() => api("/api/push-creatives", { id: creative.id, row_version: creative.row_version, patch: { ...f, web_url: f.web_url || null } }, "PATCH"), "Saved");
  }
  return (
    <form onSubmit={save} className="flex flex-col gap-4 text-sm">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="flex flex-col gap-3">
          <input name="label" defaultValue={creative.label} disabled={!draft} className={field} />
          <label className="flex flex-col gap-1"><span className="text-zinc-500">Title · {new TextEncoder().encode(title).length}/{LIMITS.titleBytes} bytes</span><input name="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!draft} className={field} /></label>
          <label className="flex flex-col gap-1"><span className="text-zinc-500">Body · {new TextEncoder().encode(body).length}/{LIMITS.bodyBytes} bytes</span><textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} disabled={!draft} rows={4} className={field} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <select name="message_class" defaultValue={creative.message_class} disabled={!draft} className={field}><option value="transactional">transactional</option><option value="marketing">marketing</option></select>
            <select name="route" defaultValue={creative.route} disabled={!draft} className={field}>{ROUTE_KEYS.map((r) => <option key={r} value={r} disabled={!IMPLEMENTED_ROUTES.has(r)}>{r}</option>)}</select>
            <input name="web_url" defaultValue={creative.web_url ?? ""} disabled={!draft} placeholder="https:// (optional)" className={field} />
          </div>
        </div>
        {/* phone-shaped preview */}
        <div className="rounded-[20px] border-4 border-zinc-800 bg-zinc-100 p-3 dark:bg-zinc-900">
          <div className="rounded-lg bg-white p-3 shadow dark:bg-zinc-800"><p className="text-[10px] text-zinc-500">Nesh Push · now</p><p className="truncate font-medium">{title || "Title"}</p><p className="line-clamp-3 text-xs text-zinc-600 dark:text-zinc-300">{body || "Body"}</p></div>
          <p className="mt-2 text-[10px] text-zinc-500">tap → {creative.route}</p>
        </div>
      </div>
      <p className="text-zinc-500">server bytes: title {titleBytes}, body {bodyBytes}{lint.length > 0 && <span className="text-amber-600"> · lint: {lint.join(", ")}</span>}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={button} disabled={!draft || busy}>Save draft</button>
        <button type="button" className={secondary} onClick={() => call(() => api(`/api/push-creatives/${creative.id}/preview`, {}), "Preview (read-only)")} disabled={busy}>Preview payload</button>
        <button type="button" className={secondary} disabled={!draft || lint.length > 0 || busy} onClick={() => call(() => api(`/api/push-creatives/${creative.id}/approve`, { row_version: creative.row_version }), "Approved and frozen. Go to Send to use it.")}>Approve</button>
        {busy && <Spinner className="text-zinc-500" />}
      </div>
      {msg && <p role="status">{msg}</p>}
      {out && <pre className="overflow-auto rounded bg-zinc-100 p-3 text-xs dark:bg-zinc-800">{out}</pre>}
      <section><h2 className="mb-1 font-medium">Approved versions</h2>{versions.length === 0 && <p className="text-zinc-500">None.</p>}<ul>{versions.map((v) => <li key={v.id} className="font-mono text-xs">v{v.version} {v.id} sha256 {v.artifact_sha256.slice(0, 12)}…</li>)}</ul></section>
    </form>
  );
}
