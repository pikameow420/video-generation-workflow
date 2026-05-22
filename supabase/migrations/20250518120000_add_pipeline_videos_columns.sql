ALTER TABLE public.pipeline_videos 
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS pipeline_videos_is_deleted_idx 
  ON public.pipeline_videos (is_deleted);

COMMENT ON COLUMN public.pipeline_videos.title IS 'Optional title from the script, used for display in the library';
COMMENT ON COLUMN public.pipeline_videos.is_deleted IS 'Soft delete flag to hide videos without removing them';
