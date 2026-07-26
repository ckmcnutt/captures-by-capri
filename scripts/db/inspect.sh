#!/usr/bin/env bash
#
# Report the facts about a restored database that decide how the Drizzle schema
# must be written. Run this after restore-dump.sh and BEFORE writing any code.
#
# What to look for:
#   * appointment.id must be serial / "BY DEFAULT" identity. If it is
#     "ALWAYS", the Cal.com webhook's explicit-id insert fails outright and
#     needs OVERRIDING SYSTEM VALUE, which Drizzle does not emit.
#   * timestamptz vs bare timestamp on start_time/end_time/created_at. Bare
#     timestamp means the scheduler's day-window maths compares wall-clock to UTC.
#   * final_invoice_amount precision/scale (it must serialise to JSON as a
#     number, not a string).
#   * Whether status id 2 really is appointment_canceled and 12 really is
#     appointment_rejected -- the edge function hardcoded those.
set -euo pipefail

cd "$(dirname "$0")/../.."

psql() { docker compose exec -T postgres psql -U capri -d capri "$@"; }

echo "############ Postgres version"
psql -Atc 'SELECT version()'

echo
echo "############ Tables"
psql -c '\dt'

echo
echo "############ Column types, defaults, identity"
psql -c "
SELECT table_name, column_name, data_type, is_nullable,
       numeric_precision AS prec, numeric_scale AS scale,
       is_identity, identity_generation, column_default
  FROM information_schema.columns
 WHERE table_schema = 'public'
 ORDER BY table_name, ordinal_position;"

echo
echo "############ Constraints (note the odd capital-A FK names)"
psql -c "
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS def
  FROM pg_constraint
 WHERE connamespace = 'public'::regnamespace
 ORDER BY conrelid::regclass::text, conname;"

echo
echo "############ Indexes"
psql -c "SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname;"

echo
echo "############ appointment_status ids  <-- verify 2=canceled, 12=rejected"
psql -c 'SELECT id, status_name, status_desc FROM appointment_status ORDER BY id;'

echo
echo "############ category ids"
psql -c 'SELECT id, category_name FROM category ORDER BY id;'

echo
echo "############ Row counts"
psql -c "
SELECT 'appointment' t, count(*) FROM appointment
UNION ALL SELECT 'appointment_status', count(*) FROM appointment_status
UNION ALL SELECT 'category', count(*) FROM category
UNION ALL SELECT 'customer', count(*) FROM customer
UNION ALL SELECT 'photo', count(*) FROM photo;"

echo
echo "############ Sequence positions vs max(id)  <-- last_value must be >= max"
psql -c "
SELECT 'appointment' t, (SELECT max(id) FROM appointment) max_id,
       (SELECT last_value FROM pg_sequences
         WHERE schemaname='public' AND sequencename = split_part(pg_get_serial_sequence('appointment','id'),'.',2)) last_value
UNION ALL
SELECT 'customer', (SELECT max(id) FROM customer),
       (SELECT last_value FROM pg_sequences
         WHERE schemaname='public' AND sequencename = split_part(pg_get_serial_sequence('customer','id'),'.',2))
UNION ALL
SELECT 'photo', (SELECT max(id) FROM photo),
       (SELECT last_value FROM pg_sequences
         WHERE schemaname='public' AND sequencename = split_part(pg_get_serial_sequence('photo','id'),'.',2));"

echo
echo "############ Duplicate customer emails (must be resolved before the unique index)"
psql -c "SELECT lower(email_address) email, count(*) FROM customer GROUP BY 1 HAVING count(*) > 1;"

echo
echo "############ photo.url host distribution"
psql -c "SELECT split_part(split_part(url,'//',2),'/',1) AS host, count(*) FROM photo GROUP BY 1 ORDER BY 2 DESC;"
