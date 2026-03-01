# ── Build stage ──────────────────────────────
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./

# Copy package manifests for all workspaces (for npm install)
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

# Install all dependencies
RUN npm install

# Copy source code
COPY packages/types/ ./packages/types/
COPY apps/api/ ./apps/api/

# Build shared types first
RUN npm run build --workspace=packages/types

# Generate Prisma client
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Build the API
RUN npm run build --workspace=apps/api

# ── Production stage ─────────────────────────
FROM node:20-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json

RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/entrypoint.sh ./apps/api/entrypoint.sh
RUN chmod +x ./apps/api/entrypoint.sh

# Re-generate Prisma client for production image
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

CMD ["./apps/api/entrypoint.sh"]
