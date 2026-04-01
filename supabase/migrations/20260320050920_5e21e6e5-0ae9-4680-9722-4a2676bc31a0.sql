
-- Add tags to saved_notes and saved_study_materials
ALTER TABLE public.saved_notes ADD COLUMN tags text[] DEFAULT '{}';
ALTER TABLE public.saved_study_materials ADD COLUMN note_id uuid REFERENCES public.saved_notes(id) ON DELETE SET NULL;
ALTER TABLE public.saved_study_materials ADD COLUMN tags text[] DEFAULT '{}';

-- Index for tag searching
CREATE INDEX idx_saved_notes_tags ON public.saved_notes USING GIN(tags);
CREATE INDEX idx_saved_study_materials_tags ON public.saved_study_materials USING GIN(tags);
CREATE INDEX idx_saved_study_materials_note_id ON public.saved_study_materials(note_id);
