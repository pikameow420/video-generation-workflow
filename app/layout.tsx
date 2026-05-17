import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({subsets:['latin'],variable:'--font-sans'});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Social — Script to video",
  description:
    "Generate scripts, a character sheet, and a Seedance video via Atlas Cloud",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.variable, geistMono.variable, "font-sans", inter.variable)}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 bg-white/85 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/85">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <Link
              href="/"
              className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100"
            >
              AI Social
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium">
              <Link
                href="/"
                className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Pipeline
              </Link>
              <Link
                href="/videos"
                className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Video library
              </Link>
            </nav>
          </div>
        </header>
        <div className="flex-1">{children}</div>
        <Toaster />
      </body>
    </html>
  );
}
