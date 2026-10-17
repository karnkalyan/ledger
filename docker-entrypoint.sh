#!/bin/sh
set -e

echo "=========================================================="
echo "  Mediko Suite Starting            "
echo "=========================================================="

# Retry loop to wait for host MySQL to become available
echo "==> [Prisma] Connecting to MySQL and synchronizing schema..."
MAX_RETRIES=20
COUNT=0
until npx prisma db push --skip-generate --accept-data-loss; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "==> [Error] Failed to connect to MySQL after $MAX_RETRIES attempts. Check DATABASE_URL and host network."
    exit 1
  fi
  echo "==> MySQL not ready yet. Retrying in 3 seconds... ($COUNT/$MAX_RETRIES)"
  sleep 3
done
echo "==> [Prisma] Database schema is up to date!"

# Run master seed if enabled (default: false to prevent background collision)
if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "==> [Seed] Executing master seed script (prisma/seed.ts)..."
  npx tsx prisma/seed.ts || echo "==> [Notice] Seed script completed with warnings or was already initialized."
else
  echo "==> [Seed] SEED_ON_STARTUP is false. Skipping seed data."
fi

echo "==> Starting Mediko Next.js server on port ${PORT:-3081}..."
exec "$@"
