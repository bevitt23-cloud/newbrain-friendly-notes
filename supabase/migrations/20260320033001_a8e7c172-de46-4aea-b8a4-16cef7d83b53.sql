
-- Create the update_updated_at_column function first
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Store cognitive profile from the setup wizard
CREATE TABLE public.cognitive_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  traits text[] NOT NULL DEFAULT '{}',
  wizard_answers jsonb NOT NULL DEFAULT '{}',
  hyper_fixation text,
  wizard_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cognitive_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cognitive profile"
  ON public.cognitive_profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own cognitive profile"
  ON public.cognitive_profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cognitive profile"
  ON public.cognitive_profiles FOR UPDATE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_cognitive_profiles_updated_at
  BEFORE UPDATE ON public.cognitive_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
