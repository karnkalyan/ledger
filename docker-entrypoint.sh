#!/bin/sh
set -e

echo "=========================================================="
echo "  Leader Ledger Suite Starting                            "
echo "=========================================================="

# Auto-configure GEMINI_API_KEY from base64 if not provided
if [ -z "$GEMINI_API_KEY" ] || [ "$GEMINI_API_KEY" = "configured-in-local-env" ] || echo "$GEMINI_API_KEY" | grep -q "^QVEu"; then
  export GEMINI_API_KEY="$(echo 'QVEuQWI4Uk42TDRLWGpLb1UxemF6Qkl6eUY2c3NYTEp2U2pYMXdfVTF1WGktYVBCY0tmcWc=' | base64 -d 2>/dev/null || echo "$GEMINI_API_KEY")"
fi


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
  node scripts/ensure_sync.js || true
fi

echo "==> Starting Leader Next.js server on port ${PORT:-3080}..."
if [ "$1" = "next" ] && [ "$2" = "start" ]; then
  exec node scripts/start-server.js
fi
exec "$@"
