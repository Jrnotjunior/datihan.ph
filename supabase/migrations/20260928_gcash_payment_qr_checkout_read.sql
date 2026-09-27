-- DATIHAN.PH: allow authenticated customers to read only active GCash QR records.
-- The payment QR image itself is stored in the public payment-qr bucket.

drop policy if exists "Customers can view active payment QR" on public.payment_qr_codes;

create policy "Customers can view active payment QR"
  on public.payment_qr_codes
  for select
  to authenticated
  using (is_active = true);
