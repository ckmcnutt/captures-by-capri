-- Fast-forward every id sequence past the highest existing id.
--
-- MANDATORY after any data-only load. `pg_dump --data-only` does not emit
-- setval(), so the sequence sits at 1 and the very next sequence-driven insert
-- collides with restored data.
--
-- This matters doubly for `appointment`: the Cal.com webhook inserts rows with an
-- explicit id (the Cal bookingId), which never advances the sequence. See the
-- post-insert bump in the appointments repository for the permanent runtime fix.
--
-- Safe and idempotent: GREATEST(..., 1) handles empty tables, and setval to a
-- value already reached is a no-op.

SELECT 'appointment' AS table_name,
       setval(pg_get_serial_sequence('appointment', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM appointment), 1)) AS new_value
UNION ALL
SELECT 'appointment_status',
       setval(pg_get_serial_sequence('appointment_status', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM appointment_status), 1))
UNION ALL
SELECT 'category',
       setval(pg_get_serial_sequence('category', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM category), 1))
UNION ALL
SELECT 'customer',
       setval(pg_get_serial_sequence('customer', 'id'),
              GREATEST((SELECT COALESCE(MAX(id), 1) FROM customer), 1));
