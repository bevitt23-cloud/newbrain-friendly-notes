-- Create storage bucket for uploaded study materials
INSERT INTO storage.buckets (id, name, public)
VALUES ('study-uploads', 'study-uploads', false);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload study files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'study-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to read their own files
CREATE POLICY "Users can read own study files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'study-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own study files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'study-uploads' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow service role to read files (for edge function processing)
CREATE POLICY "Service role can read all study files"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'study-uploads');