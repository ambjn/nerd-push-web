import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
export const metadata: Metadata = { title: "Nerd Push", description: "Send a push notification to a registered device" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.className}>
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased dark:bg-black dark:text-zinc-50">
        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <nav className="mx-auto flex w-full max-w-3xl items-center gap-6 px-6 py-3 text-sm">
            <span className="font-semibold">Nerd Push</span>
            <Link href="/" className="hover:underline">Send</Link>
            <Link href="/creatives" className="hover:underline">Creatives</Link>
          </nav>
        </header>
        <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6"><Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>{children}</Suspense></main>
      </body>
    </html>
  );
}
