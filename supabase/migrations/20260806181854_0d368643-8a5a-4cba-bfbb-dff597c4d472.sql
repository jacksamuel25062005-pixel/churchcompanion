CREATE POLICY "Admins read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (private.is_admin_or_super(auth.uid()));