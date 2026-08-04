ALTER TABLE "appointment" ADD COLUMN "deposit_requested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "deposit_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "invoice_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "appointment" ADD COLUMN "invoice_paid" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Backfill the new booleans from the status each appointment currently sits in,
-- before that status is collapsed away below. Each boolean is true for every
-- status at or past the point it represents in the old linear flow
-- (deposit_requested -> deposit_paid -> invoice_sent -> invoice_paid), since a
-- later status implies every earlier step already happened.
UPDATE "appointment" SET "deposit_requested" = true
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status"
  WHERE "status_name" IN ('deposit_requested', 'deposit_paid', 'invoice_sent', 'invoice_paid', 'editing_photos', 'photos_released', 'appointment_complete')
);--> statement-breakpoint

UPDATE "appointment" SET "deposit_paid" = true
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status"
  WHERE "status_name" IN ('deposit_paid', 'invoice_sent', 'invoice_paid', 'editing_photos', 'photos_released', 'appointment_complete')
);--> statement-breakpoint

UPDATE "appointment" SET "invoice_sent" = true
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status"
  WHERE "status_name" IN ('invoice_sent', 'invoice_paid', 'editing_photos', 'photos_released', 'appointment_complete')
);--> statement-breakpoint

UPDATE "appointment" SET "invoice_paid" = true
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status"
  WHERE "status_name" IN ('invoice_paid', 'editing_photos', 'photos_released', 'appointment_complete')
);--> statement-breakpoint

-- Collapse the removed intermediate statuses onto the five that remain.
-- deposit_requested has no boolean-only equivalent status yet, so it folds back
-- to appointment_requested (still awaiting the deposit). deposit_paid,
-- invoice_sent, invoice_paid, and editing_photos all become appointment_confirmed
-- — an appointment is "confirmed" for the lifetime between the deposit clearing
-- and the session being marked complete, with the booleans now carrying the
-- finer-grained progress. photos_released was the last step before completion,
-- so those rows become appointment_complete.
UPDATE "appointment" SET "status_id" = (
  SELECT "id" FROM "appointment_status" WHERE "status_name" = 'appointment_requested'
)
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status" WHERE "status_name" = 'deposit_requested'
);--> statement-breakpoint

UPDATE "appointment" SET "status_id" = (
  SELECT "id" FROM "appointment_status" WHERE "status_name" = 'appointment_confirmed'
)
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status"
  WHERE "status_name" IN ('deposit_paid', 'invoice_sent', 'invoice_paid', 'editing_photos')
);--> statement-breakpoint

UPDATE "appointment" SET "status_id" = (
  SELECT "id" FROM "appointment_status" WHERE "status_name" = 'appointment_complete'
)
WHERE "status_id" IN (
  SELECT "id" FROM "appointment_status" WHERE "status_name" = 'photos_released'
);--> statement-breakpoint

-- Now safe to drop: no appointment row references these status ids anymore.
DELETE FROM "appointment_status"
WHERE "status_name" IN ('deposit_requested', 'deposit_paid', 'invoice_sent', 'invoice_paid', 'editing_photos', 'photos_released');