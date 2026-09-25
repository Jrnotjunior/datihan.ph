CREATE OR REPLACE FUNCTION public.get_admin_shops()
RETURNS TABLE(
  id uuid,
  owner_name text,
  email text,
  product_count bigint,
  popup_count bigint,
  created_at timestamp with time zone
)
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    u.id,
    COALESCE(
      NULLIF(
        TRIM(CONCAT_WS(' ',
          u.raw_user_meta_data ->> 'first_name',
          u.raw_user_meta_data ->> 'last_name'
        )),
        ''
      ),
      'Unnamed shop owner'
    )::text AS owner_name,
    u.email::text,
    (
      SELECT COUNT(*)
      FROM public.products p
      WHERE p.owner_id = u.id
    ) AS product_count,
    (
      SELECT COUNT(*)
      FROM public.pop_up_events e
      WHERE e.owner_id = u.id
    ) AS popup_count,
    u.created_at
  FROM auth.users u
  INNER JOIN public.profiles p
    ON p.id = u.id
  WHERE p.role = 'shop_owner'
    AND EXISTS (
      SELECT 1
      FROM public.profiles admin_profile
      WHERE admin_profile.id = auth.uid()
        AND admin_profile.role = 'admin'
    )
  ORDER BY u.created_at DESC;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_shops() TO authenticated;
