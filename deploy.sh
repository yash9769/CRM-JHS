#!/usr/bin/env bash
# Pulls the latest commit for DEPLOY_BRANCH (from .env) and (re)builds the stack in
# place. Run from inside a checkout directory — e.g. ~/apps/crm-staging (DEPLOY_BRANCH=
# staging) or ~/apps/crm-production (DEPLOY_BRANCH=main). Same script for both; the only
# difference between environments is which directory/branch/.env you're sitting in.
#
# Deliberately reads DEPLOY_BRANCH from .env rather than inferring it from "whatever
# branch this checkout currently has open" — the latter silently keeps deploying the old
# branch forever if a deploy branch is ever renamed (as happened once already here).
#
# Used by .github/workflows/deploy-staging.yml and deploy-production.yml over SSH, and
# safe to run by hand for the same effect.
set -euo pipefail

if [ ! -f .env ]; then
  echo "No .env in $(pwd) — see docs/DEPLOYMENT_BHARAT_CLOUD.md before running this." >&2
  exit 1
fi

DEPLOY_BRANCH=$(grep -m1 '^DEPLOY_BRANCH=' .env | cut -d= -f2-)
if [ -z "$DEPLOY_BRANCH" ]; then
  echo "No DEPLOY_BRANCH in $(pwd)/.env — see docs/DEPLOYMENT_BHARAT_CLOUD.md." >&2
  exit 1
fi

git fetch origin
git checkout -B "$DEPLOY_BRANCH" "origin/$DEPLOY_BRANCH"

docker compose up -d --build

# Drop images/layers no longer referenced by any container — keeps a long-lived VM
# from quietly filling its disk with every previous build.
docker image prune -f
