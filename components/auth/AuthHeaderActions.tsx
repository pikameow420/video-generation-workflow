"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";

export function AuthHeaderActions() {
  const { email, loading, signOut } = useAuthSession();

  if (loading) {
    return null;
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="hidden max-w-[12rem] truncate text-xs text-zinc-500 sm:inline dark:text-zinc-400">
        {email}
      </span>
      <Button variant="outline" size="sm" onClick={() => void signOut()}>
        Sign out
      </Button>
    </div>
  );
}
