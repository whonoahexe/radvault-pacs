# ── Build stage ──────────────────────────────
FROM node:24-alpine AS builder

RUN apk add --no-cache openssl
RUN npm install -g npm@11.6.2

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./

# Copy package manifests for all workspaces (for npm install)
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json

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
FROM node:24-alpine AS runner

RUN apk add --no-cache openssl curl

WORKDIR /app

ENV NODE_ENV=production

# Copy node_modules directly from builder (avoids npm prune workspace issues)
COPY --from=builder /app/node_modules ./node_modules
# Merge workspace-local packages into root node_modules so @nestjs/core can find them
COPY --from=builder /app/apps/api/node_modules ./node_modules

# Copy built artifacts
COPY --from=builder /app/packages/types/package.json ./packages/types/package.json
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/api/entrypoint.sh ./apps/api/entrypoint.sh
RUN sed -i 's/\r$//' ./apps/api/entrypoint.sh && chmod +x ./apps/api/entrypoint.sh

# Re-generate Prisma client for production image
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma

EXPOSE 3000

USER node

CMD ["sh", "./apps/api/entrypoint.sh"]
