import { Spinner } from "./spinner";

/** Route-level progress: shown by Next.js while a page's server data loads. */
export default function Loading() {
  return <div className="flex items-center gap-3 py-16 text-sm text-zinc-500"><Spinner /> Loading…</div>;
}
