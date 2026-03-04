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
COPY apps/worker/ ./apps/worker/

# Build the worker
RUN npm run build --workspace=apps/worker

# ── Production stage ─────────────────────────
FROM node:24-alpine AS runner

RUN npm install -g npm@11.6.2

WORKDIR /app

ENV NODE_ENV=production

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
COPY packages/types/package.json ./packages/types/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json

RUN npm install --omit=dev

# Copy built artifacts
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist

# No exposed port — worker is a background process

USER node

CMD ["node", "apps/worker/dist/index.js"]
