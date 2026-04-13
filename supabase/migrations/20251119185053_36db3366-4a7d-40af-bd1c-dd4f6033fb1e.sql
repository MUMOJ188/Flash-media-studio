-- Allow clients to update their own jobs (needed for file uploads)
CREATE POLICY "Clients can update their own jobs"
ON public.jobs
FOR UPDATE
USING (auth.uid() = client_id)
WITH CHECK (auth.uid() = client_id);