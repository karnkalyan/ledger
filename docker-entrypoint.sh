#!/bin/sh
set -e

echo "=========================================================="
echo "  Leader Ledger Suite Starting                            "
echo "=========================================================="

# Retry loop to wait for host MySQL to become available
echo "==> [Prisma] Connecting to MySQL and synchronizing schema..."
MAX_RETRIES=20
COUNT=0
until npx prisma db push --skip-generate; do
  COUNT=$((COUNT + 1))
  if [ "$COUNT" -ge "$MAX_RETRIES" ]; then
    echo "==> [Error] Failed to connect to MySQL after $MAX_RETRIES attempts. Check DATABASE_URL and host network."
    exit 1
  fi
  echo "==> MySQL not ready yet. Retrying in 3 seconds... ($COUNT/$MAX_RETRIES)"
  sleep 3
done
echo "==> [Prisma] Database schema is up to date!"

# Run master seed ONLY if explicitly enabled (default: false to preserve entered data)
if [ "${SEED_ON_STARTUP:-false}" = "true" ]; then
  echo "==> [Seed] SEED_ON_STARTUP=true. Executing master seed script..."
  npx tsx prisma/seed.ts || echo "==> [Notice] Seed script completed with warnings."
else
  echo "==> [Seed] SEED_ON_STARTUP is false. Preserving existing user data (skipping seed)."
fi

echo "==> Starting Leader Next.js server on port ${PORT:-3080}..."
exec "$@"
