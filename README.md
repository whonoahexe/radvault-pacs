# RadVault PACS

RadVault is a full-stack, DICOMweb-enabled radiology PACS built for clinical workflow simulation: ingest studies via STOW-RS, query metadata via QIDO-RS, view pixel data through Orthanc WADO-RS, manage radiology worklists, author/sign/amend structured reports, and capture audit events with role-based access control.

## Quick Start

```bash
cp .env.example .env
docker compose up --build
# Wait ~60 seconds for seed bootstrap to complete
```

Web UI: `http://localhost:3001`  
API base: `http://localhost:3000`

## Demo Accounts

| Email                      | Password   | Full Name       | Role               |
| -------------------------- | ---------- | --------------- | ------------------ |
| admin@radvault.local       | Admin1234! | System Admin    | Admin              |
| radiologist@radvault.local | Rad1234!   | Dr. Sarah Chen  | Radiologist        |
| tech@radvault.local        | Tech1234!  | James Wright    | Technologist       |
| referring@radvault.local   | Ref1234!   | Dr. Marcus Reid | ReferringPhysician |

## Architecture Overview

RadVault uses a modular-monolith NestJS API, a Next.js frontend, Orthanc as the DICOM server, PostgreSQL for metadata/worklist/report persistence, Redis for queueing, and a background worker for thumbnail processing and asynchronous tasks. For full architecture diagrams and request flows, see [ARCHITECTURE.md](ARCHITECTURE.md).

## Environment Variables

The following variables from `.env.example` are required for local stack startup.

| Variable                       | Description                                                           |
| ------------------------------ | --------------------------------------------------------------------- |
| `NODE_ENV`                     | Runtime environment (`development` for local compose).                |
| `POSTGRES_USER`                | PostgreSQL username used by the API and seed jobs.                    |
| `POSTGRES_PASSWORD`            | PostgreSQL password for the configured user.                          |
| `POSTGRES_DB`                  | PostgreSQL database name.                                             |
| `DATABASE_URL`                 | Prisma/NestJS PostgreSQL connection string.                           |
| `REDIS_URL`                    | Redis connection string for queues/caching.                           |
| `MINIO_ROOT_USER`              | MinIO admin access key.                                               |
| `MINIO_ROOT_PASSWORD`          | MinIO admin secret key.                                               |
| `MINIO_BUCKET`                 | S3 bucket name for DICOM and thumbnails.                              |
| `MINIO_ENDPOINT`               | MinIO/S3 endpoint URL used by services.                               |
| `ORTHANC_URL`                  | Internal Orthanc base URL used by API/worker.                         |
| `JWT_PRIVATE_KEY`              | PEM private key used to sign JWT access tokens.                       |
| `JWT_PUBLIC_KEY`               | PEM public key used to verify JWTs.                                   |
| `JWT_EXPIRY`                   | Access token expiration window.                                       |
| `REFRESH_TOKEN_EXPIRY`         | Refresh token expiration window.                                      |
| `WORKER_JWT`                   | Optional worker token for Orthanc callbacks; auto-generated if empty. |
| `OTEL_EXPORTER_OTLP_ENDPOINT`  | OpenTelemetry trace export endpoint.                                  |
| `GF_SECURITY_ADMIN_PASSWORD`   | Grafana admin password.                                               |
| `NEXT_PUBLIC_API_URL`          | Browser-visible base URL for API calls.                               |
| `NEXT_PUBLIC_ORTHANC_WADO_URL` | Browser-visible Orthanc WADO/DICOMweb URL.                            |

## Running Tests

Run from `apps/api`:

```bash
npm run test:unit        # unit tests (CI-safe)
npm run test:coverage    # with coverage report
npm run test:integration # requires running stack
```

## API Documentation

Swagger UI is available at `http://localhost:3000/docs` after `docker compose up`.
Standalone OpenAPI artifact generation and verification is available via:

```bash
npm run -w @radvault/api openapi:verify
```

This writes and validates `apps/api/openapi/openapi.json`.

## Submission Validator

From the assessment repository, run:

```bash
make check REPO=.
```
