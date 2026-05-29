"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuthSession } from "@/hooks/useAuthSession";
import { scriptHistoryOpenPath } from "@/lib/pipeline/script-history-open";

export function AppMobileNav() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { email, loading: authLoading, signOut } = useAuthSession();

  function handleScriptHistory() {
    setOpen(false);
    router.push(scriptHistoryOpenPath());
  }

  const linkClass =
    "block w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div className="lg:hidden">
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </SheetTrigger>
      </div>

      <SheetContent side="left" showCloseButton className="gap-0 p-0">
        <SheetHeader className="pr-12">
          <SheetTitle>Menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigation links and account actions
          </SheetDescription>
        </SheetHeader>

        <nav
          className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
          aria-label="Main navigation"
        >
          <Link href="/" className={linkClass} onClick={() => setOpen(false)}>
            Create
          </Link>
          <Link href="/library" className={linkClass} onClick={() => setOpen(false)}>
            My videos
          </Link>
          <button
            type="button"
            className={`${linkClass} block lg:hidden`}
            onClick={handleScriptHistory}
          >
            My Script History
          </button>
        </nav>

        <SheetFooter className="shrink-0">
          {authLoading ? null : email ? (
            <div className="w-full space-y-2">
              <p className="truncate px-3 text-xs text-zinc-500">{email}</p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  void signOut();
                }}
              >
                Sign out
              </Button>
            </div>
          ) : (
            <Link href="/login" className={linkClass} onClick={() => setOpen(false)}>
              Sign in
            </Link>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
