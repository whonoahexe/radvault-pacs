# ── Build stage ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./

# Copy package manifests
COPY packages/types/package.json ./packages/types/package.json
COPY apps/web/package.json ./apps/web/package.json

# Install all dependencies
RUN npm install

# Copy source
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

# Build shared types
RUN npm run build --workspace=packages/types

# Build Next.js (standalone output)
RUN npm run build --workspace=apps/web

# ── Production stage ─────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
