#!/bin/sh
set -e

echo "Running Prisma DB push..."
npx prisma db push --schema=apps/api/prisma/schema.prisma --skip-generate

echo "Starting API server..."
exec node apps/api/dist/main.js
