# Implementation Process

## 1) Requirement Intake and Source-of-Truth Lock

- Read `templates/REQUIREMENTS.md` and `templates/ARCHITECTURE.md` fully before changing code.
- Treated those documents as authoritative for service boundaries, data model, route structure, and infrastructure topology.
- Used conservative defaults only where the docs did not specify an explicit value.

## 2) Documentation-First Resolution (Context7)

Before writing or changing code involving the required stack, I resolved current docs via Context7 for:

- Prisma 7 config style (`prisma.config.ts` + `defineConfig` + datasource URL handling)
- NestJS Terminus health-check patterns
- BullMQ worker setup patterns
- OpenTelemetry Node SDK + OTLP HTTP exporter behavior
- Orthanc authorization plugin configuration keys (`WebServiceRootUrl`, `TokenHttpHeaders`, `CheckedLevel`)

## 3) Workspace Audit and Gap Analysis

- Audited monorepo root, app package manifests, Dockerfiles, compose, Prisma schema/config, and route structure.
- Identified mismatches against requested constraints, including:
  - Node image version drift (`node:20-alpine` vs required `node:24-alpine`)
  - Semver ranges instead of exact pins
  - Prisma flow using schema datasource URL and `db push` instead of migrate deploy
  - Next route-group structure mismatches
  - Missing/incorrect infra config paths and env values

## 4) Implementation Passes

### Pass A — Monorepo and Tooling

- Updated root package settings (`packageManager`, `engines`) and turbo pipeline tasks.
- Standardized strict TS base config with shared path alias.
- Added/normalized workspace scripts (`lint`, `typecheck`, `test`) for all packages.

### Pass B — API and Prisma

- Added Prisma 7 config file in `apps/api/prisma.config.ts`.
- Updated Prisma schema shape and generator compatibility.
- Changed entrypoint to `prisma migrate deploy` (no `db push`).
- Implemented health/readiness with:
  - PostgreSQL connectivity check via Prisma query
  - Redis connectivity check via raw socket PING
- Kept internal Orthanc callback endpoint stub returning `{ granted: true, validity: 0 }`.
- Kept domain modules in stub/no-business-logic state where requested.

### Pass C — Web and Worker

- Reworked Next route structure to match required `(app)` grouping and paths.
- Added protected app layout redirect behavior to login when token is missing.
- Kept route pages as placeholder stubs only.
- Kept Zustand store as an empty stub state.
- Added `components.json` for shadcn default initialization metadata.
- Implemented BullMQ worker stub for queue `thumbnail-generation`, logging receipt/completion, and graceful shutdown.

### Pass D — Docker and Infra

- Switched all app Dockerfiles to `node:24-alpine` multi-stage.
- Ensured runtime stage runs as non-root `node` user.
- Updated compose to 11-service topology on `radvault` bridge network.
- Aligned healthchecks, dependencies, ports, and named volumes to the requested spec.
- Updated `.env.example` to support `cp .env.example .env && docker compose up --build` with placeholders.
- Aligned Prometheus and Grafana datasource provisioning files.
- Updated Orthanc config to required callback/storage keys.

## 5) Validation and Fix Loop

Validation sequence used:

1. `npm install`
2. `npm run lint`
3. `npm run typecheck`
4. `npm run build`

Fixes applied during validation:

- Resolved package-version compatibility issues in NestJS ecosystem by aligning dependent package majors.
- Removed workspace-local type conflicts and resolved TS type boundary issues in Nest + Swagger wiring.
- Addressed Next.js 14 build constraint requiring `next.config.js` (not `next.config.ts`) to keep builds green.
- Added Prisma config fallback URL to avoid local build failure when `DATABASE_URL` is absent in shell.

Final state after fixes:

- Lint passes
- Typecheck passes
- Build passes
- No editor diagnostics remaining at handoff time

## 6) Scope Guardrails Followed

- No business logic implemented beyond required health/internal stubs.
- No extra pages/features beyond specified route scaffolds.
- Changes remained focused on requested architecture/runtime/infrastructure constraints.
- Exact pinning used in package manifests (no `^`/`~`).
