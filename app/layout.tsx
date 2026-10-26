import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { currentOperator } from "@/lib/control/auth";
import { LogoutButton } from "@/components/logout-button";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = { title: "Nerd Push", description: "Staging push notification control plane" };

const nav = [["/", "Overview"], ["/creatives", "Creatives"], ["/sends", "Sends"]] as const;

/** Reads the session cookie, so it renders at request time behind Suspense. */
async function Sidebar() {
  const op = await currentOperator().catch(() => null);
  if (!op) return null;
  return (
          <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950 sm:flex">
            <h1 className="mb-8 text-lg font-semibold tracking-tight">Nerd Push</h1>
            <nav className="flex flex-col gap-1 text-sm">
              {nav.map(([href, text]) => (
                <Link key={href} href={href} className="rounded-md px-3 py-2 text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900">{text}</Link>
              ))}
            </nav>
            <div className="mt-auto text-xs text-zinc-500">
              <p className="truncate">{op.email}</p>
              <p>role: {op.role}</p>
              <LogoutButton />
            </div>
          </aside>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-50">
        <Suspense fallback={null}><Sidebar /></Suspense>
        <main className="flex flex-1 flex-col gap-6 p-6 sm:p-10"><Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>{children}</Suspense></main>
      </body>
    </html>
  );
}
