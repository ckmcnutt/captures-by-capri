#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")" || exit 1

OUTPUT=$(git pull)

if [[ "$OUTPUT" == *"Already up to date."* ]]; then
    echo "Changes detected! Deploying update..."
    GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build
else
    echo "New changes pulled!"
fi