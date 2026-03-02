#!/bin/sh
set -e

cd /app

echo "Running Prisma migrate deploy..."
npx prisma migrate deploy --config apps/api/prisma.config.ts

echo "Ensuring Prisma schema is applied..."
npx prisma db push --config apps/api/prisma.config.ts

echo "Starting API server in background for seed callbacks..."
node apps/api/dist/main.js &
API_PID=$!

cleanup() {
	if kill -0 "$API_PID" 2>/dev/null; then
		kill "$API_PID"
	fi
}

trap cleanup INT TERM

echo "Running seed script..."
if ! npx tsx apps/api/prisma/seed.ts; then
	cleanup
	exit 1
fi

echo "API server running (PID: $API_PID)"
wait "$API_PID"
