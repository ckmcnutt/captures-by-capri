#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")" || exit 1
git pull
GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build