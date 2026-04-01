ALTER TABLE public.saved_notes
ADD COLUMN IF NOT EXISTS saved_videos jsonb NOT NULL DEFAULT '[]'::jsonb;