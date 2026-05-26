"use client";

import { CharacterProfileLibrary } from "@/components/pipeline/steps/character/CharacterProfileLibrary";
import type { CharacterProfileLibraryProps } from "@/components/pipeline/steps/character/CharacterProfileLibrary";
import { CharacterRunSetup } from "@/components/pipeline/steps/character/CharacterRunSetup";
import type { CharacterRunSetupProps } from "@/components/pipeline/steps/character/CharacterRunSetup";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export type CharacterStepProps = {
  busy: boolean;
  library: Omit<CharacterProfileLibraryProps, "busy">;
  runSetup: Omit<CharacterRunSetupProps, "busy">;
};

export function CharacterStep({ busy, library, runSetup }: CharacterStepProps) {
  return (
    <Card className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border-zinc-200 bg-white shadow-sm duration-300 dark:border-zinc-800 dark:bg-zinc-950/50">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
            3
          </div>
          <CardTitle className="text-xl">Set up your character</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pb-6">
        <CharacterProfileLibrary {...library} busy={busy} />
        <CharacterRunSetup {...runSetup} busy={busy} />
      </CardContent>
    </Card>
  );
}
