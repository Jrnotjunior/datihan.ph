-- Order status values used by the owner order-management page.
-- Run this once in the Supabase SQL Editor.

ALTER TABLE public.orders
DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (
  status = ANY (
    ARRAY[
      'pending'::text,
      'confirmed'::text,
      'shipped'::text,
      'delivered'::text,
      'cancelled'::text,
      'returned_refunded'::text
    ]
  )
);
