-- DATIHAN admin users list
-- Run this once in the Supabase SQL Editor.
-- The function is read-only and can only be called by an admin.

CREATE OR REPLACE FUNCTION public.get_admin_users()
RETURNS TABLE (
  id uuid,
  email text,
  first_name text,
  last_name text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    u.email::text,
    p.first_name,
    p.last_name,
    p.role,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_users() TO authenticated;
