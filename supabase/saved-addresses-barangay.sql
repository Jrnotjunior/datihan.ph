-- Add barangay to saved customer addresses.
-- Run this once in the Supabase SQL Editor before testing the new address form.

ALTER TABLE public.saved_addresses
ADD COLUMN IF NOT EXISTS barangay text;

COMMENT ON COLUMN public.saved_addresses.barangay IS 'Barangay / village / local administrative area of the saved shipping address';
