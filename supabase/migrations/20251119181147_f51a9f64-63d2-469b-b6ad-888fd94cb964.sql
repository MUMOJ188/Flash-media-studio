-- Update job-files bucket to allow all file types
UPDATE storage.buckets
SET 
  allowed_mime_types = NULL,  -- NULL means all MIME types are allowed
  file_size_limit = 52428800  -- 50MB limit
WHERE id = 'job-files';

-- Ensure proper RLS policies exist for job-files bucket
-- Drop existing policies if any
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own job files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all job files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own job files" ON storage.objects;

-- Policy for authenticated users to upload their own files
CREATE POLICY "Users can upload job files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy for admins to view all job files
CREATE POLICY "Admins can view all job files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-files' AND
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy for users to view their own job files
CREATE POLICY "Users can view own job files"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);