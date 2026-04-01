ALTER TABLE public.user_preferences
  ADD COLUMN fun_fact_mode text NOT NULL DEFAULT 'material',
  ADD COLUMN fun_fact_custom_topic text NULL;