"use client";

import { useState } from "react";

const field =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:focus:border-zinc-600";

export default function ComposeForm() {
  const [queued, setQueued] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setQueued(String(data.get("to")));
    e.currentTarget.reset();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">To</span>
        <input name="to" type="email" required placeholder="someone@example.com" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Subject</span>
        <input name="subject" required placeholder="Weekly update" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Body</span>
        <textarea name="body" required rows={8} placeholder="Write your email..." className={field} />
      </label>
      <div className="flex items-center gap-4">
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Send
        </button>
        {queued && (
          <p role="status" className="text-sm text-emerald-600 dark:text-emerald-400">
            Queued for {queued}
          </p>
        )}
      </div>
    </form>
  );
}
