ALTER TABLE appointment
  ADD COLUMN IF NOT EXISTS cal_booking_uid TEXT,
  ADD COLUMN IF NOT EXISTS stripe_deposit_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_final_invoice_id TEXT,
  ADD COLUMN IF NOT EXISTS final_invoice_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS photo_delivery_url TEXT;
