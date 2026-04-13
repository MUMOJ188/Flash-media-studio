-- Create or replace the get_admin_for_messaging function to query profiles table
-- This function allows clients to get admin ID for messaging without exposing admin profiles
CREATE OR REPLACE FUNCTION public.get_admin_for_messaging()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id 
  FROM public.profiles 
  WHERE role = 'admin' 
  LIMIT 1
$$;