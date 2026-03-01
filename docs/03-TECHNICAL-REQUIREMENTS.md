# Technical Requirements

This document specifies what RadVault must do. Read this alongside the [Domain Primer](02-DOMAIN-PRIMER.md) for context on *why* these features matter clinically.

## Requirement Priority Legend

| Label | Meaning |
|---|---|
| **MUST** | Required for a passing submission |
| **SHOULD** | Expected for a strong submission |
| **MAY** | Bonus — demonstrates depth |

---

## 1. Backend Services

### 1.1 DICOM Ingestion (STOW-RS)

| Requirement | Priority |
|---|---|
| Accept DICOM files via `POST /studies` (multipart/related) | MUST |
| Parse DICOM headers and extract metadata (Patient, Study, Series, Instance) | MUST |
| Store pixel data in object storage (S3-compatible or filesystem) | MUST |
| Index metadata in the relational database | MUST |
| Validate DICOM conformance (reject non-DICOM uploads) | SHOULD |
| Support bulk upload (multiple instances in one request) | SHOULD |
| Generate thumbnails on ingestion for study browser | SHOULD |
| Publish ingestion events (for worklist updates, notifications) | MAY |

**Implementation notes:**
- Use an existing DICOM parsing library (e.g., `pydicom`, `dcmjs`, `fo-dicom`). Do not write your own parser.
- Separate metadata storage (relational DB) from pixel data storage (object/blob). This is a core architectural decision — justify it in your requirements doc.
- DICOM files can be large (100MB+ for multi-frame). Consider streaming and chunked uploads.

### 1.2 DICOM Query (QIDO-RS)

| Requirement | Priority |
|---|---|
| `GET /studies` — query studies by patient name, ID, date, modality, accession number | MUST |
| `GET /studies/{studyUID}/series` — list series in a study | MUST |
| `GET /studies/{studyUID}/series/{seriesUID}/instances` — list instances | MUST |
| Return results as `application/dicom+json` | MUST |
| Support wildcard matching (e.g., `DOE*`) | SHOULD |
| Support date range queries (e.g., `20240101-20240315`) | SHOULD |
| Pagination (`offset` and `limit` parameters) | SHOULD |
| `includefield` parameter for controlling response fields | MAY |

### 1.3 DICOM Retrieve (WADO-RS)

| Requirement | Priority |
|---|---|
| `GET /studies/{studyUID}` — retrieve all instances in a study | MUST |
| `GET .../instances/{instanceUID}` — retrieve a single instance | MUST |
| `GET .../instances/{instanceUID}/rendered` — return rendered frame as JPEG/PNG | MUST |
| Support `Accept` header negotiation (DICOM vs. rendered) | SHOULD |
| Frame-level retrieval for multi-frame instances | MAY |
| Transfer syntax negotiation | MAY |

### 1.4 Worklist Service

| Requirement | Priority |
|---|---|
| Auto-create worklist entry when a new study is ingested | MUST |
| Query worklist with filters (status, modality, date, assigned radiologist) | MUST |
| Claim/unclaim a study (assign to radiologist) | MUST |
| Status transitions: Scheduled → In Progress → Preliminary → Final → Amended | MUST |
| Priority levels (Routine, Urgent, STAT) | SHOULD |
| Worklist entry includes study metadata + patient demographics | SHOULD |
| Real-time worklist updates via WebSocket or SSE | MAY |

### 1.5 Reporting Service

| Requirement | Priority |
|---|---|
| Create a draft report linked to a study | MUST |
| Structured report sections: Indication, Technique, Comparison, Findings, Impression | MUST |
| Save drafts (auto-save preferred) | MUST |
| Sign/finalize a report (transitions worklist to Final) | MUST |
| Report versioning (track edits between drafts) | SHOULD |
| Addendum workflow (post-signature amendments) | SHOULD |
| Report templates per modality/study type | MAY |
| PDF export of finalized reports | MAY |

### 1.6 Authentication & Authorization

| Requirement | Priority |
|---|---|
| JWT-based authentication | MUST |
| Role-based access control (RBAC): Admin, Radiologist, Technologist, Referring Physician | MUST |
| Login/logout endpoints | MUST |
| Password hashing (bcrypt or argon2) | MUST |
| Refresh token rotation | SHOULD |
| Permission matrix: Radiologists read/report, Techs upload, Physicians view reports | SHOULD |
| Session management (concurrent session limits) | MAY |

### 1.7 Audit Logging

| Requirement | Priority |
|---|---|
| Log every PHI access event (who, what resource, when, action) | MUST |
| Immutable log entries (append-only) | MUST |
| Log authentication events (login, logout, failed attempts) | SHOULD |
| Log report lifecycle events (create, edit, sign, amend) | SHOULD |
| Query audit log by user, resource, date range | MAY |

---

## 2. Frontend

### 2.1 Study Browser

| Requirement | Priority |
|---|---|
| Searchable study list with filters (patient name, date, modality, status) | MUST |
| Display study metadata (patient info, modality, date, description, status) | MUST |
| Thumbnail previews for each study | SHOULD |
| Sort by date, patient name, priority | SHOULD |
| Click-through to open study in the diagnostic viewer | MUST |
| Responsive layout | SHOULD |

### 2.2 Diagnostic Viewer

You may use **Cornerstone.js** or **OHIF Viewer** as a foundation. We evaluate *integration quality*, not whether you built a DICOM viewer from scratch.

| Requirement | Priority |
|---|---|
| Display DICOM images with proper windowing (window/level controls) | MUST |
| Scroll through series (slice navigation for CT/MR stacks) | MUST |
| Pan, zoom | MUST |
| Window/level presets (Lung, Bone, Soft Tissue, Brain) | SHOULD |
| Series panel showing all series in the study | SHOULD |
| Length measurement tool | SHOULD |
| Multi-viewport layout (at least 1x1 and 2x2) | MAY |
| Hanging protocols (auto-arrange series by study type) | MAY |
| Annotation persistence (save measurements/markups) | MAY |

### 2.3 Reporting Interface

| Requirement | Priority |
|---|---|
| Structured report editor (sections for Indication, Findings, Impression, etc.) | MUST |
| Linked to the study being read — show patient/study context | MUST |
| Save draft and sign/finalize actions | MUST |
| Rich text editing (bold, italic, lists) | SHOULD |
| Report templates | MAY |
| Side-by-side view: images on one side, report editor on the other | MAY |

### 2.4 Admin Interface

| Requirement | Priority |
|---|---|
| User management (create, edit, deactivate users) | MUST |
| Role assignment | MUST |
| Audit log viewer | SHOULD |
| System status/health dashboard | MAY |

---

## 3. Data Model

At minimum, your schema must include:

| Entity | Key Fields |
|---|---|
| **Patient** | patient_id, name, date_of_birth, sex |
| **Study** | study_instance_uid, study_date, study_description, modality, accession_number, referring_physician → Patient |
| **Series** | series_instance_uid, series_number, series_description, modality → Study |
| **Instance** | sop_instance_uid, instance_number, rows, columns, storage_path → Series |
| **User** | id, username, email, password_hash, role, is_active |
| **Report** | id, content (structured), status (draft/preliminary/final/amended), signed_by, signed_at → Study |
| **WorklistItem** | id, status, priority, assigned_to, claimed_at → Study |
| **AuditLog** | id, user_id, action, resource_type, resource_id, timestamp, ip_address |

You are expected to extend this with additional fields and relationships as appropriate.

---

## 4. Infrastructure & DevOps

### 4.1 Containerization

| Requirement | Priority |
|---|---|
| Docker Compose file that brings up the full stack | MUST |
| Multi-stage Dockerfile(s) for production-like builds | MUST |
| `docker compose up` works from a clean clone with seed data | MUST |
| Named volumes for persistent data (database, object storage) | SHOULD |
| Health checks on all services | SHOULD |

### 4.2 Infrastructure as Code

| Requirement | Priority |
|---|---|
| Terraform or Pulumi configuration for cloud deployment | MUST |
| Must `plan`/`validate` without errors (no actual deployment needed) | MUST |
| Modules for: compute, database, storage, networking | SHOULD |
| Environment separation (dev/staging/prod) via variables | SHOULD |
| Secrets management (not hardcoded) | MUST |

### 4.3 CI/CD Pipeline

| Requirement | Priority |
|---|---|
| GitHub Actions (or equivalent) pipeline definition | MUST |
| Lint step | MUST |
| Test step with coverage reporting | MUST |
| Build/push container images | SHOULD |
| Security scanning (dependency audit, secret detection) | MAY |

### 4.4 Observability

| Requirement | Priority |
|---|---|
| Structured logging (JSON format) | SHOULD |
| Health check endpoints (`/health`, `/ready`) | SHOULD |
| Prometheus-compatible metrics endpoint | MAY |
| OpenTelemetry tracing | MAY |
| Grafana dashboard configuration | MAY |

---

## 5. Seed Data

Your Docker Compose setup must include seed data so reviewers can immediately interact with the system:

| Seed Data | Details |
|---|---|
| **Users** | At least 3: admin, radiologist, referring physician. Document credentials in README. |
| **Patients** | At least 5 synthetic patients |
| **Studies** | At least 3 DICOM studies (use publicly available test data — see [Resources](05-RESOURCES.md)) |
| **Worklist** | At least 2 studies in different states (Scheduled, In Progress) |
| **Reports** | At least 1 finalized report for demo purposes |

> **Important:** Use synthetic/anonymized data only. Never include real PHI.

---

## 6. Bonus Challenges

These are stretch goals. Attempting any of them demonstrates depth and ambition.

| Bonus | Description |
|---|---|
| **DICOM De-identification** | Strip PHI from DICOM headers on demand (for research export) |
| **Prior Study Comparison** | Display current and prior studies side-by-side in the viewer |
| **AI Integration Stub** | API endpoint that accepts a study and returns mock AI analysis (e.g., "nodule detected") |
| **FHIR ImagingStudy** | Expose imaging metadata as FHIR resources |
| **Real-time Notifications** | WebSocket/SSE push for new studies, report completions |
| **Multi-tenancy** | Support multiple imaging facilities with data isolation |

---

## Next Steps

1. Review the [Evaluation Rubric](04-EVALUATION-RUBRIC.md) to understand how you'll be scored
2. Check the [Resources](05-RESOURCES.md) for helpful libraries and test data
3. Start your [Requirements Document](../templates/REQUIREMENTS.md)
