CREATE TABLE IF NOT EXISTS public.prediction_ownership (
  prediction_id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('atlas', 'muapi')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prediction_ownership_user_id_idx ON public.prediction_ownership (user_id);
CREATE INDEX IF NOT EXISTS prediction_ownership_created_at_idx ON public.prediction_ownership (created_at);

ALTER TABLE public.prediction_ownership ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.prediction_ownership IS 'Tracks which user initiated each video generation job to prevent unauthorized access to in-progress predictions';
COMMENT ON COLUMN public.prediction_ownership.prediction_id IS 'The predictionId returned from Atlas or MuAPI';
COMMENT ON COLUMN public.prediction_ownership.provider IS 'Which backend generated this video';
