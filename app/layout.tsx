import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AuthHeaderActions } from "@/components/auth/AuthHeaderActions";
import { TooltipProvider } from "@/components/ui/tooltip";
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
  title: "AI Social — Ideas to short videos",
  description:
    "Write or generate a script, build a visual reference sheet, and export a 15-second social video.",
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
        <TooltipProvider delayDuration={200}>
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
                  Create
                </Link>
                <Link
                  href="/library"
                  className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  My videos
                </Link>
                <AuthHeaderActions />
              </nav>
            </div>
          </header>
          <div className="flex-1">{children}</div>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
