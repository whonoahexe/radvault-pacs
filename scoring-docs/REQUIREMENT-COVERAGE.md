# Technical Requirements Coverage (MUST / SHOULD / MAY)

Assessment date: 2026-03-03
Method: repository scan of docs/, templates/, scoring/, api/web/worker/infra + validator output.
Legend: ✅ Implemented, ⚠️ Partial, ❌ Missing

---

## 1. Backend Services

### 1.1 DICOM Ingestion (STOW-RS)

| Requirement                                                                 | Priority | Status | Evidence / Notes                                                                             |
| --------------------------------------------------------------------------- | -------- | -----: | -------------------------------------------------------------------------------------------- |
| Accept DICOM files via POST /studies (multipart/related)                    | MUST     |     ✅ | `api/dicom-web/studies` endpoint exists; content type enforced as `multipart/related`.       |
| Parse DICOM headers and extract metadata (Patient, Study, Series, Instance) | MUST     |     ✅ | DICOM metadata fetched from Orthanc and persisted into patient/study/series/instance tables. |
| Store pixel data in object storage (S3-compatible or filesystem)            | MUST     |     ✅ | Orthanc configured with S3 plugin to MinIO in compose/Orthanc config.                        |
| Index metadata in relational database                                       | MUST     |     ✅ | Prisma schema + upsert flow stores and indexes metadata in PostgreSQL.                       |
| Validate DICOM conformance (reject non-DICOM uploads)                       | SHOULD   |     ⚠️ | API validates content type; full DICOM conformance delegated to Orthanc rejection behavior.  |
| Support bulk upload (multiple instances in one request)                     | SHOULD   |     ✅ | STOW stream forwarding supports multipart payloads with multiple instances.                  |
| Generate thumbnails on ingestion for study browser                          | SHOULD   |     ✅ | Thumbnail job queued on ingest; worker renders/stores thumbnail and updates study record.    |
| Publish ingestion events (for worklist updates, notifications)              | MAY      |     ⚠️ | Internal queue job event exists; no explicit external event bus/notification publish API.    |

### 1.2 DICOM Query (QIDO-RS)

| Requirement                                                         | Priority | Status | Evidence / Notes                                                                        |
| ------------------------------------------------------------------- | -------- | -----: | --------------------------------------------------------------------------------------- |
| GET /studies query by patient name, ID, date, modality, accession   | MUST     |     ✅ | Query parameters implemented in DICOM controller/service and mapped to Prisma filters.  |
| GET /studies/{studyUID}/series list series                          | MUST     |     ✅ | Implemented endpoint returns `application/dicom+json`.                                  |
| GET /studies/{studyUID}/series/{seriesUID}/instances list instances | MUST     |     ✅ | Implemented endpoint returns DICOM JSON list.                                           |
| Return results as application/dicom+json                            | MUST     |     ✅ | Controller sets content-type accordingly for query responses.                           |
| Support wildcard matching (e.g., DOE\*)                             | SHOULD   |     ⚠️ | Uses `contains` filters; wildcard token semantics (`*`) are not explicitly implemented. |
| Support date range queries (20240101-20240315)                      | SHOULD   |     ✅ | `StudyDate` parser enforces and applies range format.                                   |
| Pagination (offset and limit parameters)                            | SHOULD   |     ⚠️ | Supports `page`/`limit`, not `offset`/`limit` as specified.                             |
| includefield parameter for response fields                          | MAY      |     ❌ | No `includefield` handling found in query API.                                          |

### 1.3 DICOM Retrieve (WADO-RS)

| Requirement                                              | Priority | Status | Evidence / Notes                                                                   |
| -------------------------------------------------------- | -------- | -----: | ---------------------------------------------------------------------------------- |
| GET /studies/{studyUID} retrieve all instances in study  | MUST     |     ✅ | Available via Orthanc DICOMweb route (`/dicom-web/...`) in stack design.           |
| GET .../instances/{instanceUID} retrieve single instance | MUST     |     ✅ | Available via Orthanc DICOMweb retrieve APIs.                                      |
| GET .../instances/{instanceUID}/rendered return JPEG/PNG | MUST     |     ✅ | Used by worker and viewer via Orthanc rendered endpoints.                          |
| Support Accept header negotiation (DICOM vs rendered)    | SHOULD   |     ⚠️ | Likely provided by Orthanc; no explicit app-level negotiation logic validated.     |
| Frame-level retrieval for multi-frame instances          | MAY      |     ✅ | Viewer uses WADO frame URLs (`/frames/1`), demonstrating frame-level path support. |
| Transfer syntax negotiation                              | MAY      |     ⚠️ | Likely inherited from Orthanc; no explicit contract/validation in app code.        |

### 1.4 Worklist Service

| Requirement                                                                | Priority | Status | Evidence / Notes                                                                                  |
| -------------------------------------------------------------------------- | -------- | -----: | ------------------------------------------------------------------------------------------------- |
| Auto-create worklist entry on new study ingest                             | MUST     |     ✅ | DICOM ingest transaction upserts worklist item with `Scheduled` status.                           |
| Query worklist with filters (status, modality, date, assigned radiologist) | MUST     |     ⚠️ | Status/priority/assigned filters exist; modality/date are not first-class worklist query filters. |
| Claim/unclaim study                                                        | MUST     |     ✅ | Claim transition and explicit unclaim endpoint implemented with guard checks.                     |
| Status transitions Scheduled → In Progress → Preliminary → Final → Amended | MUST     |     ✅ | State machine implemented and enforced in service/tests.                                          |
| Priority levels (Routine, Urgent, STAT)                                    | SHOULD   |     ✅ | Enum and sorting logic support priority values.                                                   |
| Worklist entry includes study metadata + patient demographics              | SHOULD   |     ✅ | Worklist query includes joined study/patient context fields.                                      |
| Real-time worklist updates via WebSocket or SSE                            | MAY      |     ❌ | No websocket/SSE implementation detected for live updates.                                        |

### 1.5 Reporting Service

| Requirement                                                                          | Priority | Status | Evidence / Notes                                                           |
| ------------------------------------------------------------------------------------ | -------- | -----: | -------------------------------------------------------------------------- |
| Create draft report linked to study                                                  | MUST     |     ✅ | Report create endpoint persists draft tied to study ID.                    |
| Structured report sections (Indication, Technique, Comparison, Findings, Impression) | MUST     |     ✅ | DTO/schema/frontend fields include all required sections.                  |
| Save drafts (auto-save preferred)                                                    | MUST     |     ✅ | Save endpoint exists; frontend autosaves draft on interval while dirty.    |
| Sign/finalize report (transitions worklist to Final)                                 | MUST     |     ✅ | Sign endpoint updates report status and transitions linked worklist state. |
| Report versioning (track edits between drafts)                                       | SHOULD   |     ✅ | `ReportVersion` snapshots created on create/update/sign/amend paths.       |
| Addendum workflow (post-signature amendments)                                        | SHOULD   |     ✅ | Amend endpoint creates new amended report from final report state.         |
| Report templates per modality/study type                                             | MAY      |     ❌ | No template engine or modality-linked template selection found.            |
| PDF export of finalized reports                                                      | MAY      |     ❌ | No PDF export endpoint or UI action detected.                              |

### 1.6 Authentication & Authorization

| Requirement                                                 | Priority | Status | Evidence / Notes                                                                                          |
| ----------------------------------------------------------- | -------- | -----: | --------------------------------------------------------------------------------------------------------- |
| JWT-based authentication                                    | MUST     |     ✅ | JWT strategy/guards and signed access tokens implemented.                                                 |
| RBAC: Admin, Radiologist, Technologist, Referring Physician | MUST     |     ✅ | Roles enum + decorators/guards + role-gated endpoints/UI.                                                 |
| Login/logout endpoints                                      | MUST     |     ✅ | `/api/auth/login`, `/api/auth/logout` implemented.                                                        |
| Password hashing (bcrypt/argon2)                            | MUST     |     ✅ | Uses bcrypt for user creation and login validation.                                                       |
| Refresh token rotation                                      | SHOULD   |     ✅ | Refresh token table + revoke/create rotation + family reuse detection.                                    |
| Permission matrix by role                                   | SHOULD   |     ⚠️ | Mostly implemented; coverage is strong but not fully formalized/documented as a strict matrix test suite. |
| Session management (concurrent session limits)              | MAY      |     ❌ | No concurrent-session cap logic found.                                                                    |

### 1.7 Audit Logging

| Requirement                                              | Priority | Status | Evidence / Notes                                                                                                                 |
| -------------------------------------------------------- | -------- | -----: | -------------------------------------------------------------------------------------------------------------------------------- |
| Log every PHI access event (who/resource/when/action)    | MUST     |     ⚠️ | Broad audit logging exists (study/report/auth/worklist); “every PHI access” completeness is hard to guarantee from current scan. |
| Immutable log entries (append-only)                      | MUST     |     ⚠️ | Application writes append-only and no update/delete APIs, but DB-level immutability controls are not clearly enforced.           |
| Log authentication events (login/logout/failed attempts) | SHOULD   |     ⚠️ | Login/logout are logged; failed-login logging path not clearly verified.                                                         |
| Log report lifecycle events (create/edit/sign/amend)     | SHOULD   |     ✅ | Explicit audit actions emitted for report lifecycle transitions.                                                                 |
| Query audit log by user, resource, date range            | MAY      |     ⚠️ | Query supports user/date/action; resource-type/resource-id filtering is not exposed.                                             |

---

## 2. Frontend

### 2.1 Study Browser

| Requirement                                                       | Priority | Status | Evidence / Notes                                                                  |
| ----------------------------------------------------------------- | -------- | -----: | --------------------------------------------------------------------------------- |
| Searchable study list with filters (patient/date/modality/status) | MUST     |     ⚠️ | Patient/date/modality filters implemented; status filter UI is missing.           |
| Display study metadata (patient/modality/date/description/status) | MUST     |     ✅ | Table renders required metadata fields and worklist-derived status badge.         |
| Thumbnail previews per study                                      | SHOULD   |     ✅ | Thumbnail image shown when available (fallback for missing thumbnail).            |
| Sort by date, patient name, priority                              | SHOULD   |     ⚠️ | Sort supports date + patient name; priority sort is not present in study browser. |
| Click-through to open study in diagnostic viewer                  | MUST     |     ✅ | Row click/open action routes to study viewer.                                     |
| Responsive layout                                                 | SHOULD   |     ✅ | Uses responsive utility classes (`grid-cols-1`, `xl`, `md`) across major pages.   |

### 2.2 Diagnostic Viewer

| Requirement                                         | Priority | Status | Evidence / Notes                                                                 |
| --------------------------------------------------- | -------- | -----: | -------------------------------------------------------------------------------- |
| Display DICOM images with proper windowing controls | MUST     |     ✅ | Cornerstone viewer renders DICOM with VOI presets applied as windowing controls. |
| Scroll through series (slice navigation)            | MUST     |     ✅ | Wheel + keyboard slice navigation and stack loading implemented.                 |
| Pan, zoom                                           | MUST     |     ✅ | Pan/Zoom tools configured and toggleable.                                        |
| Window/level presets (Lung/Bone/Soft Tissue/Brain)  | SHOULD   |     ✅ | Preset buttons implemented with VOI ranges.                                      |
| Series panel showing all series                     | SHOULD   |     ✅ | Series panel lists series and allows selection.                                  |
| Length measurement tool                             | SHOULD   |     ✅ | Length tool wired and selectable.                                                |
| Multi-viewport layout (1x1 and 2x2)                 | MAY      |     ❌ | Single viewport only.                                                            |
| Hanging protocols                                   | MAY      |     ❌ | No auto-arrangement protocols detected.                                          |
| Annotation persistence                              | MAY      |     ❌ | No persisted measurement/annotation storage found.                               |

### 2.3 Reporting Interface

| Requirement                           | Priority | Status | Evidence / Notes                                                 |
| ------------------------------------- | -------- | -----: | ---------------------------------------------------------------- |
| Structured report editor sections     | MUST     |     ✅ | Five required sections rendered as editable fields.              |
| Linked to study context               | MUST     |     ✅ | Report page shows study/patient context and linked viewer panel. |
| Save draft + sign/finalize actions    | MUST     |     ✅ | Save/autosave + sign preliminary/final + amend actions present.  |
| Rich text editing (bold/italic/lists) | SHOULD   |     ❌ | Uses plain textareas; no rich-text controls.                     |
| Report templates                      | MAY      |     ❌ | No report template selection/application found.                  |
| Side-by-side images and editor        | MAY      |     ✅ | Two-column layout with viewer and report editor side by side.    |

### 2.4 Admin Interface

| Requirement                                      | Priority | Status | Evidence / Notes                                                                             |
| ------------------------------------------------ | -------- | -----: | -------------------------------------------------------------------------------------------- |
| User management (create, edit, deactivate users) | MUST     |     ⚠️ | Create/deactivate supported in UI; edit exists in API but not fully surfaced in UI controls. |
| Role assignment                                  | MUST     |     ✅ | Role assignment on create and API update path exists.                                        |
| Audit log viewer                                 | SHOULD   |     ✅ | Admin page includes audit table with action filter.                                          |
| System status/health dashboard                   | MAY      |     ❌ | No admin health dashboard page/widget found.                                                 |

---

## 3. Data Model

| Requirement                                                                                            | Priority | Status | Evidence / Notes                                                                           |
| ------------------------------------------------------------------------------------------------------ | -------- | -----: | ------------------------------------------------------------------------------------------ |
| Include core entities and key fields (Patient/Study/Series/Instance/User/Report/WorklistItem/AuditLog) | MUST     |     ✅ | Prisma schema includes all required entities and expected key field equivalents/relations. |
| Extend with additional fields/relationships as appropriate                                             | SHOULD   |     ✅ | Adds refresh tokens, report versions, Orthanc IDs, JSON tag storage, lifecycle timestamps. |

---

## 4. Infrastructure & DevOps

### 4.1 Containerization

| Requirement                                         | Priority | Status | Evidence / Notes                                                                                    |
| --------------------------------------------------- | -------- | -----: | --------------------------------------------------------------------------------------------------- |
| Docker Compose full stack                           | MUST     |     ✅ | `docker-compose.yml` defines API/web/worker/postgres/redis/minio/orthanc/observability stack.       |
| Multi-stage Dockerfiles for production-like builds  | MUST     |     ✅ | Multi-service Dockerfiles are present and used by compose/CI.                                       |
| `docker compose up` from clean clone with seed data | MUST     |     ✅ | README + seed flow indicate this path; validator compose checks pass.                               |
| Named volumes for persistence                       | SHOULD   |     ✅ | Named volumes defined for DB/Redis/MinIO/Grafana.                                                   |
| Health checks on all services                       | SHOULD   |     ⚠️ | Major app services have health checks; not every ancillary service has explicit healthcheck stanza. |

### 4.2 Infrastructure as Code

| Requirement                                     | Priority | Status | Evidence / Notes                                                                                     |
| ----------------------------------------------- | -------- | -----: | ---------------------------------------------------------------------------------------------------- |
| Terraform/Pulumi for cloud deployment           | MUST     |     ✅ | Terraform root/modules present.                                                                      |
| plan/validate without errors                    | MUST     |     ⚠️ | Structure appears valid; explicit fresh-run `terraform validate/plan` was not executed in this pass. |
| Modules for compute/database/storage/networking | SHOULD   |     ✅ | Modules exist for compute/database/storage/networking (+cache/monitoring).                           |
| Environment separation via variables            | SHOULD   |     ✅ | Uses `environment` and variable-driven module inputs.                                                |
| Secrets management (not hardcoded)              | MUST     |     ⚠️ | Env/SSM-based approach present; scanner still flags secret-pattern risk areas for cleanup.           |

### 4.3 CI/CD Pipeline

| Requirement                                           | Priority | Status | Evidence / Notes                                       |
| ----------------------------------------------------- | -------- | -----: | ------------------------------------------------------ |
| GitHub Actions pipeline definition                    | MUST     |     ✅ | `.github/workflows/ci.yml` exists.                     |
| Lint step                                             | MUST     |     ✅ | Turbo lint job configured.                             |
| Test step with coverage reporting                     | MUST     |     ✅ | Test job runs and uploads coverage artifact.           |
| Build/push container images                           | SHOULD   |     ⚠️ | Builds images in CI; push is disabled (`push: false`). |
| Security scanning (dependency audit/secret detection) | MAY      |     ❌ | No dedicated security scanning stage detected.         |

### 4.4 Observability

| Requirement                        | Priority | Status | Evidence / Notes                                                                     |
| ---------------------------------- | -------- | -----: | ------------------------------------------------------------------------------------ |
| Structured logging (JSON format)   | SHOULD   |     ⚠️ | JSON in production mode; dev mode uses colored text logs.                            |
| Health endpoints (/health, /ready) | SHOULD   |     ✅ | Both endpoints implemented in health controller.                                     |
| Prometheus metrics endpoint        | MAY      |     ✅ | `@willsoto/nestjs-prometheus` module registered; metrics endpoint exposed by module. |
| OpenTelemetry tracing              | MAY      |     ✅ | OTel Node SDK + OTLP exporter initialized at startup.                                |
| Grafana dashboard configuration    | MAY      |     ✅ | Grafana service + provisioning/datasource config included in infra.                  |

---

## 5. Seed Data

| Seed Data Requirement                                        | Priority | Status | Evidence / Notes                                                               |
| ------------------------------------------------------------ | -------- | -----: | ------------------------------------------------------------------------------ |
| At least 3 users incl. admin/radiologist/referring physician | MUST     |     ✅ | Four demo users seeded and documented in README.                               |
| At least 5 synthetic patients                                | MUST     |     ✅ | DICOM-seeded patients + additional synthetic patient seeds total ≥ 5.          |
| At least 3 DICOM studies                                     | MUST     |     ✅ | Seed includes CT/MR/SC sample DICOM files and upload flow.                     |
| Worklist has at least 2 studies in different states          | MUST     |     ✅ | Seeded states include Scheduled and InProgress (plus Final/Preliminary paths). |
| At least 1 finalized report                                  | MUST     |     ✅ | Seed creates finalized report/version for demo.                                |
| Synthetic/anonymized data only                               | MUST     |     ✅ | Uses test/sample synthetic datasets and generated demo identities.             |

---

## 6. Bonus Challenges

| Bonus                   | Status | Notes            |
| ----------------------- | -----: | ---------------- |
| DICOM De-identification |     ❌ | Not implemented. |
| Prior Study Comparison  |     ❌ | Not implemented. |
| AI Integration Stub     |     ❌ | Not implemented. |
| FHIR ImagingStudy       |     ❌ | Not implemented. |
| Real-time Notifications |     ❌ | Not implemented. |
| Multi-tenancy           |     ❌ | Not implemented. |

---

## Overall Priority Completion Snapshot

- MUST: Mostly complete with a few partials (notably study-browser status filter, full immutable-audit enforcement confidence, and some worklist filter semantics).
- SHOULD: Mixed; several done well (thumbnails, presets, versioning, CI basics), but notable misses (wildcard semantics, offset pagination, rich text, realtime worklist updates).
- MAY: Select infra/viewer capabilities present; many product-depth bonuses not implemented.
