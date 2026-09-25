-- DATIHAN admin dashboard statistics
-- Run this once in the Supabase SQL Editor.
-- The function is read-only and can only be called by the admin role.

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_role text;
  total_users integer := 0;
  total_buyers integer := 0;
  total_shop_owners integer := 0;
  total_admins integer := 0;
  total_products integer := 0;
  total_orders integer := 0;
  pending_orders integer := 0;
BEGIN
  current_role := public.get_my_role();

  IF current_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT COUNT(*)::integer INTO total_users
  FROM public.profiles;

  SELECT COUNT(*)::integer INTO total_buyers
  FROM public.profiles
  WHERE role = 'buyer';

  SELECT COUNT(*)::integer INTO total_shop_owners
  FROM public.profiles
  WHERE role = 'shop_owner';

  SELECT COUNT(*)::integer INTO total_admins
  FROM public.profiles
  WHERE role = 'admin';

  -- Product/order tables may be connected separately during the next phases.
  -- Return 0 until those tables exist, instead of making the dashboard fail.
  IF to_regclass('public.products') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.products'
      INTO total_products;
  END IF;

  IF to_regclass('public.orders') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*)::integer FROM public.orders'
      INTO total_orders;
    EXECUTE 'SELECT COUNT(*)::integer FROM public.orders WHERE status = ''pending'''
      INTO pending_orders;
  END IF;

  RETURN jsonb_build_object(
    'total_users', total_users,
    'buyers', total_buyers,
    'shop_owners', total_shop_owners,
    'admins', total_admins,
    'total_products', total_products,
    'total_orders', total_orders,
    'pending_orders', pending_orders
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats() TO authenticated;
