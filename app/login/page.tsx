"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const field = "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f) });
    if (res.ok) { router.push("/"); router.refresh(); } else setError("Invalid email or password");
  }
  return (
    <main className="mx-auto mt-24 flex w-full max-w-sm flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">Sign in</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input name="email" type="email" placeholder="Email" required className={field} />
        <input name="password" type="password" placeholder="Password" required className={field} />
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900">Sign in</button>
      </form>
    </main>
  );
}
