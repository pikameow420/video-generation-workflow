import { Suspense } from "react";

import { LoginForm } from "@/components/auth/LoginForm";
import { Spinner } from "@/components/ui/spinner";

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-lg flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2 text-center">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          AI Social
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Sign in to generate scripts, character sheets, and videos.
        </p>
      </div>
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Spinner className="size-6" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
