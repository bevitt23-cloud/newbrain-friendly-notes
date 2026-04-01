ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS tldr_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS jargon_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS feynman_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recall_prompts_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS simplify_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS why_care_default boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS color_tags_default boolean NOT NULL DEFAULT true;