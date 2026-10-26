import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });
export const metadata: Metadata = { title: "Nerd Push", description: "Send a push notification to a registered device" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.className}>
      <body className="min-h-full bg-zinc-50 text-zinc-900 antialiased dark:bg-black dark:text-zinc-50"><Suspense fallback={null}>{children}</Suspense></body>
    </html>
  );
}
