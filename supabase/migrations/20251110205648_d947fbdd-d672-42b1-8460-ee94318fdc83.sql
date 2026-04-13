-- Allow users to view admin profiles so they can send messages to admins
CREATE POLICY "Users can view admin profiles"
ON profiles
FOR SELECT
TO authenticated
USING (
  role = 'admin'
);