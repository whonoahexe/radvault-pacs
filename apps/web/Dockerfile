# ── Build stage ──────────────────────────────
FROM node:24-alpine AS builder

RUN npm install -g npm@11.6.2

WORKDIR /app

# Copy workspace root files
COPY package.json package-lock.json* turbo.json tsconfig.base.json ./

# Copy package manifests
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json

# Install all dependencies
RUN npm install

# Copy source
COPY packages/types/ ./packages/types/
COPY apps/web/ ./apps/web/

# Build shared types
RUN npm run build --workspace=packages/types

# Bake NEXT_PUBLIC_ vars into the client bundle at build time
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ORTHANC_WADO_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_ORTHANC_WADO_URL=${NEXT_PUBLIC_ORTHANC_WADO_URL}

# Build Next.js (standalone output)
RUN npm run build --workspace=apps/web

# ── Production stage ─────────────────────────
FROM node:24-alpine AS runner

RUN apk add --no-cache curl

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone output
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

USER node

CMD ["node", "apps/web/server.js"]
