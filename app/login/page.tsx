"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api, button, card, field, label } from "@/components/ui";

export default function Login() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(null);
    const f = new FormData(e.currentTarget);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: f.get("email"), password: f.get("password") }) });
      router.push("/"); router.refresh();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className={`${card} mx-auto mt-24 flex w-full max-w-sm flex-col gap-4`}>
      <h1 className="text-lg font-semibold">Staff sign in</h1>
      <label className={label}><span>Email</span><input name="email" type="email" required className={field} /></label>
      <label className={label}><span>Password</span><input name="password" type="password" required className={field} /></label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button className={button} disabled={busy}>Sign in</button>
    </form>
  );
}
