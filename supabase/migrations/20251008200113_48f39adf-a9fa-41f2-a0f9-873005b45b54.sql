-- First, ensure profiles.user_id has a unique constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);

-- Drop the existing foreign key if it exists but is misconfigured
ALTER TABLE public.jobs 
DROP CONSTRAINT IF EXISTS jobs_client_id_fkey;

-- Add the foreign key constraint properly
ALTER TABLE public.jobs 
ADD CONSTRAINT jobs_client_id_fkey 
FOREIGN KEY (client_id) 
REFERENCES public.profiles(user_id) 
ON DELETE CASCADE;