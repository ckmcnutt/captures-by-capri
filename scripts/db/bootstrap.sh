#!/usr/bin/env bash
#
# Bring a clean local database up to a usable state WITHOUT needing the
# production dump. This is the reproducible dev path:
#
#   drizzle migrations build the schema
#   -> db/seed/data.sql loads real data if present, else db:seed loads lookups
#   -> sequences fast-forwarded
#
# The production cutover path is different: pg_restore the full dump, then
# `db:migrate` adopts it as a no-op because the baseline migration is idempotent.
set -euo pipefail

cd "$(dirname "$0")/../.."

docker compose up -d --wait postgres

echo "==> Applying Drizzle migrations"
pnpm --filter @workspace/api-server run db:migrate

if [[ -f db/seed/data.sql ]]; then
  echo "==> Loading db/seed/data.sql"
  docker compose exec -T postgres psql -U capri -d capri -q -v ON_ERROR_STOP=1 < db/seed/data.sql
else
  echo "==> No db/seed/data.sql; seeding lookup tables only"
  pnpm --filter @workspace/api-server run db:seed
fi

echo "==> Syncing sequences"
docker compose exec -T postgres psql -U capri -d capri -q -f /db/sql/110_sync_sequences.sql

echo "==> Done. Start the app with: pnpm dev"
