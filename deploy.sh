#!/bin/bash

cd "$(dirname "$(readlink -f "$0")")" || exit 1
git pull

if [ "$(git rev-parse HEAD)" != "$(git rev-parse 'HEAD@{1}')" ]; then
    echo "Changes detected! Deploying update..."
    GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build
else
    echo "No new changes pulled."
fi