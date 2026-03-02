#!/bin/sh
set -e

cd /app

echo "Running Prisma migrate deploy..."
npx prisma migrate deploy --config apps/api/prisma.config.ts

echo "Starting API server..."
exec node apps/api/dist/main.js
