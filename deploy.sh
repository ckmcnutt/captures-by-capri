#!/bin/bash

# This script is intended to be run from the root of the repo, e.g.:
#   ./deploy.sh

git pull origin main
GIT_COMMIT=$(git rev-parse --short HEAD) docker compose up -d --build