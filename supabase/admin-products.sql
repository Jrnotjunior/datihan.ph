CREATE OR REPLACE FUNCTION public.get_admin_products()
RETURNS TABLE(
  id uuid,
  owner_id uuid,
  owner_email text,
  name text,
  description text,
  price numeric,
  category text,
  size text,
  condition text,
  stock integer,
  image_url text,
  is_active boolean,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    p.id,
    p.owner_id,
    u.email::text AS owner_email,
    p.name::text,
    p.description::text,
    p.price,
    p.category::text,
    p.size::text,
    p.condition::text,
    p.stock,
    p.image_url::text,
    p.is_active,
    p.created_at,
    p.updated_at
  FROM public.products p
  LEFT JOIN auth.users u
    ON u.id = p.owner_id
  WHERE EXISTS (
    SELECT 1
    FROM public.profiles admin_profile
    WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
  )
  ORDER BY p.created_at DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_admin_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_products() TO authenticated;
