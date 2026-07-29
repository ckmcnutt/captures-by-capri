#!/usr/bin/env bash
#
# Extract a data-only SQL file from the currently-restored database, so a
# from-scratch dev bootstrap works without the original dump.
#
# Output: db/seed/data.sql  (gitignored -- contains customer PII)
#
# Table order is FK-safe: pg_dump emits COPY blocks in dependency order.
set -euo pipefail

cd "$(dirname "$0")/../.."

mkdir -p db/seed

echo "==> Extracting data-only SQL to db/seed/data.sql"
docker compose exec -T postgres pg_dump -U capri -d capri \
  --data-only --no-owner --no-privileges --schema=public \
  -t appointment_status -t category -t customer -t appointment \
  > db/seed/data.sql

echo "==> Wrote $(wc -l < db/seed/data.sql) lines"

# This file holds names, emails and phone numbers. Fail loudly if it is not ignored.
if git check-ignore -q db/seed/data.sql; then
  echo "==> Confirmed gitignored (contains PII)"
else
  echo "!! WARNING: db/seed/data.sql is NOT gitignored and contains customer PII" >&2
  exit 1
fi
