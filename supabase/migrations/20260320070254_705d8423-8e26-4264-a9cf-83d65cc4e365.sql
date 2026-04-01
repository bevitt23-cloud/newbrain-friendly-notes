
-- Telemetry events table for tracking user interactions
CREATE TABLE public.telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_telemetry_user ON public.telemetry_events(user_id);
CREATE INDEX idx_telemetry_type ON public.telemetry_events(event_type);
CREATE INDEX idx_telemetry_created ON public.telemetry_events(created_at);

ALTER TABLE public.telemetry_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own telemetry"
ON public.telemetry_events FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own telemetry"
ON public.telemetry_events FOR SELECT
USING (auth.uid() = user_id);

-- User preferences table for master settings
CREATE TABLE public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  energy_mode text NOT NULL DEFAULT 'full',
  lofi_playlist_url text DEFAULT 'https://www.youtube.com/playlist?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo',
  isochronic_hz integer NOT NULL DEFAULT 15,
  gamma_beats_enabled boolean NOT NULL DEFAULT true,
  isochronic_enabled boolean NOT NULL DEFAULT true,
  lofi_enabled boolean NOT NULL DEFAULT true,
  lofi_volume numeric NOT NULL DEFAULT 0.5,
  gamma_volume numeric NOT NULL DEFAULT 0.4,
  isochronic_volume numeric NOT NULL DEFAULT 0.3,
  reduce_motion boolean NOT NULL DEFAULT false,
  bionic_reading boolean NOT NULL DEFAULT false,
  safe_to_fail boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
