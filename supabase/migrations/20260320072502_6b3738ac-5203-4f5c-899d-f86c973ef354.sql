
-- Add age to cognitive_profiles
ALTER TABLE public.cognitive_profiles ADD COLUMN IF NOT EXISTS age integer;

-- Add privacy/tracking preferences to user_preferences
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS research_data_shared boolean NOT NULL DEFAULT true;
ALTER TABLE public.user_preferences ADD COLUMN IF NOT EXISTS insights_enabled boolean NOT NULL DEFAULT true;
