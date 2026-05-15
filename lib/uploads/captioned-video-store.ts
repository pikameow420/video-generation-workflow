/** @deprecated Use pipeline-video-store; kept for import stability. */
export type CaptionedVideoRecord =
  import("@/lib/uploads/pipeline-video-store").PipelineVideoRecord;

export {
  putPipelineVideo as putCaptionedVideo,
  type PipelineVideoRecord,
} from "@/lib/uploads/pipeline-video-store";
