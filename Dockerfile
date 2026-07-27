# syntax=docker/dockerfile:1

# One image, one process: api-server serves the API, /media, and the built
# SPA (SERVE_STATIC=true) -- the same single-process design the README
# documents for the systemd deployment, just containerized instead.

FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate
WORKDIR /app
# CI=true: pnpm treats interactive prompts as hard failures instead of its
# non-interactive default otherwise.
# pnpm_config_verify_deps_before_run=false: `pnpm run` (unlike `pnpm install`)
# reruns a plain, unapproved `pnpm install` whenever it thinks node_modules is
# stale -- and COPY always looks stale to it (fresh mtimes), which re-trips
# the same build-script gate on every `pnpm run` in the build stage below.
ENV CI=true
ENV pnpm_config_verify_deps_before_run=false

# ---- deps: install with only the manifests, so this layer only invalidates
# ---- when a dependency changes, not on every source edit.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/captures-by-capri/package.json artifacts/captures-by-capri/package.json
COPY scripts/package.json scripts/package.json
# pnpm-workspace.yaml already allowlists these in onlyBuiltDependencies, but on
# a from-scratch install (no prior state, as in a fresh image layer) pnpm still
# hard-fails the first pass rather than reading that list. `|| true` lets
# packages finish linking despite the non-zero exit; approve-builds clears the
# gate; the second install is the one whose exit code actually counts.
RUN (pnpm install --frozen-lockfile || true) \
  && pnpm approve-builds --all \
  && pnpm install --frozen-lockfile

# ---- build: typecheck, compile api-server (tsc), build the SPA (vite) ----
FROM deps AS build
COPY . .
# Baked into the built SPA at build time -- vite.config.ts reads these from
# process.env during `vite build`, they are not read again at container
# runtime. See vite.config.ts and README "Environment".
ARG BASE_PATH=/
ARG CAL_URL=https://cal.com/capturesbycapri/appointment
ENV BASE_PATH=${BASE_PATH} CAL_URL=${CAL_URL}
RUN pnpm run build

# ---- prod-deps: same manifests, production dependencies only ----
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json artifacts/api-server/package.json
COPY artifacts/captures-by-capri/package.json artifacts/captures-by-capri/package.json
COPY scripts/package.json scripts/package.json
RUN pnpm install --frozen-lockfile --prod

# ---- runtime ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
# Short commit hash of the deployed source, read by env.ts and surfaced on the
# admin dashboard so a deploy can be confirmed by eye. Not baked into the SPA
# bundle since it's only needed server-side -- no rebuild-on-every-commit cost
# for the Vite stage.
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=${GIT_COMMIT}
WORKDIR /app
COPY --from=prod-deps /app ./
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/captures-by-capri/dist/public ./artifacts/captures-by-capri/dist/public

EXPOSE 3000

# busybox wget ships in the alpine base -- no need to add curl.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/api/healthz" || exit 1

CMD ["node", "artifacts/api-server/dist/index.js"]
