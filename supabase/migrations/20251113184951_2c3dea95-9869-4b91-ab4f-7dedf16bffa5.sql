-- Ensure admins can access all files in job-files bucket for download
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can view all job files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own job files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own job files" ON storage.objects;

-- Allow authenticated users to upload files to job-files bucket
CREATE POLICY "Users can upload their own job files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'job-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow users to view their own uploaded files
CREATE POLICY "Users can view their own job files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow admins to view AND download all files in job-files bucket
CREATE POLICY "Admins can access all job files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'job-files' AND
  public.is_admin(auth.uid())
);