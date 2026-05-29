import { Suspense } from "react";

import { PipelineWizard } from "@/components/pipeline/PipelineWizard";
import { Spinner } from "@/components/ui/spinner";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Spinner className="h-8 w-8 text-zinc-400" />
        </div>
      }
    >
      <PipelineWizard />
    </Suspense>
  );
}
