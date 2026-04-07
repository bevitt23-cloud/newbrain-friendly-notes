-- Add demographics columns to cognitive_profiles for research data
ALTER TABLE public.cognitive_profiles
  ADD COLUMN IF NOT EXISTS gender text,
  ADD COLUMN IF NOT EXISTS region text;
