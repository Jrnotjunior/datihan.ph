-- Allow shop owners to update the status of orders that belong to their shop.
-- Run this in the Supabase SQL Editor for the DATIHAN.PH project.

DROP POLICY IF EXISTS "Owners can update their orders" ON public.orders;

CREATE POLICY "Owners can update their orders"
ON public.orders
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);
