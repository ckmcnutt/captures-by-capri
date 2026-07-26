#!/bin/bash
# Git post-merge hook: keep deps and the database schema in sync after a pull.
set -e
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-server run db:migrate
