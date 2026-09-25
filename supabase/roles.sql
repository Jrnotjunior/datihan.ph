-- DATIHAN role system
-- One admin, one shop owner, unlimited buyers.
-- Run this once in the Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text,
  last_name text,
  role text NOT NULL DEFAULT 'buyer',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role IN ('buyer', 'shop_owner', 'admin'))
);

-- Only one admin and one shop owner may exist.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_admin_idx
  ON public.profiles (role)
  WHERE role = 'admin';

CREATE UNIQUE INDEX IF NOT EXISTS profiles_one_shop_owner_idx
  ON public.profiles (role)
  WHERE role = 'shop_owner';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users may read their own profile. Role changes are not allowed from the client.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Create a buyer profile automatically for every newly registered account.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name, role)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name',
    'buyer'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Helper used by protected database policies later.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;

-- IMPORTANT:
-- Create the single admin and single shop-owner profiles manually after
-- their Supabase Auth accounts have been created:
--
-- UPDATE public.profiles SET role = 'admin' WHERE id = '<ADMIN_AUTH_USER_ID>';
-- UPDATE public.profiles SET role = 'shop_owner' WHERE id = '<SHOP_OWNER_AUTH_USER_ID>';
--
-- Do not expose role selection on the public registration form.
