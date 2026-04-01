ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS dyslexia_font boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS font_size numeric NOT NULL DEFAULT 0.95,
  ADD COLUMN IF NOT EXISTS line_spacing numeric NOT NULL DEFAULT 1.6,
  ADD COLUMN IF NOT EXISTS letter_spacing numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS word_spacing numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS default_dark_mode boolean NOT NULL DEFAULT false;