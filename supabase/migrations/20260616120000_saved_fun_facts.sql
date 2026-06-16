-- Fun facts get their own persisted home (a "break from studying"), instead of
-- living only in memory. Mirrors the owner-only RLS style of saved_study_materials.
CREATE TABLE public.saved_fun_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  search_query TEXT NOT NULL DEFAULT '',
  search_url TEXT NOT NULL DEFAULT '',
  -- Optional link back to the note the fact was discovered in.
  source_note_id UUID REFERENCES public.saved_notes(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_saved_fun_facts_user ON public.saved_fun_facts(user_id);

ALTER TABLE public.saved_fun_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own fun facts"
ON public.saved_fun_facts FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
