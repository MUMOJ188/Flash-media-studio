-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Users can upload their own job files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own job files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all job files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view chat files they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Admins can view all chat files" ON storage.objects;

-- Add RLS policies for job-files bucket
CREATE POLICY "Users can upload their own job files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'job-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own job files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all job files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'job-files' 
  AND is_admin(auth.uid())
);

-- Add RLS policies for chat-files bucket
CREATE POLICY "Users can upload their own chat files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'chat-files' 
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view chat files they have access to"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND (
    (storage.foldername(name))[1] = auth.uid()::text 
    OR is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM messages 
      WHERE file_url = name 
      AND (sender_id = auth.uid() OR recipient_id = auth.uid())
    )
  )
);

CREATE POLICY "Admins can view all chat files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'chat-files' 
  AND is_admin(auth.uid())
);