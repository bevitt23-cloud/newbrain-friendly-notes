-- Persist tutorial dismissal across devices / browsers / cache clears.
-- Previously stored in localStorage only.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS tutorial_dismissed boolean NOT NULL DEFAULT false;
