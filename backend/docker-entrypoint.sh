#!/bin/sh
# Assembles DATABASE_URL from separate PG* fields (see docker-compose.yml) instead of
# taking it pre-built — PGPASSWORD can contain characters like "/" or "+" that are
# meaningful in a URL, so it has to be percent-encoded before going into one.
set -eu

ENCODED_PASSWORD=$(node -e 'process.stdout.write(encodeURIComponent(process.env.PGPASSWORD))')
export DATABASE_URL="postgresql://${PGUSER}:${ENCODED_PASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}?schema=public"

npx prisma migrate deploy
exec node dist/server.js
