import Link from "next/link";

import { LibraryVideoCard } from "@/components/library/LibraryVideoCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { isSupabasePersistenceEnabled } from "@/lib/persistence/backend";
import { listPipelineVideosPage } from "@/lib/uploads/pipeline-video-store";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ offset?: string }>;
}) {
  const sp = await searchParams;
  const offset = Math.max(0, Number.parseInt(sp.offset ?? "0", 10) || 0);

  const persistence = isSupabasePersistenceEnabled() ? "supabase" : "none";
  const { items, total } = await listPipelineVideosPage({
    limit: PAGE_SIZE,
    offset,
  });

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < total;
  const prevOffset = Math.max(0, offset - PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="space-y-1">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          <Link
            href="/"
            className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            ← Back to pipeline
          </Link>
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Library
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Generated videos stored when Supabase persistence is enabled (shared
          vault).
        </p>
      </header>

      {persistence === "none" ? (
        <Alert>
          <AlertDescription>
            Supabase is not configured on the server (
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              NEXT_PUBLIC_SUPABASE_URL
            </code>{" "}
            +{" "}
            <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">
              SUPABASE_SECRET_KEY
            </code>
            ). New outputs won&apos;t appear here until persistence is on.
          </AlertDescription>
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <Card className="rounded-2xl border-dashed border-zinc-300 bg-zinc-50/80 p-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No videos stored yet. Finish a pipeline run with Supabase enabled to
            see it here.
          </p>
        </Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => {
            const displayTitle = item.title?.trim() || "Untitled";
            return (
              <li key={item.id}>
                <LibraryVideoCard
                  id={item.id}
                  displayTitle={displayTitle}
                  videoUrl={item.url}
                  hasCaptions={item.hasCaptions}
                  updatedLabel={formatWhen(item.updatedAt)}
                  bytesLabel={formatBytes(item.bytes)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {total > PAGE_SIZE ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-500">
            Showing {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of {total}
          </p>
          <div className="flex gap-2">
            {canPrev ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/library?offset=${prevOffset}`}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {canNext ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/library?offset=${nextOffset}`}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
