# Detailed Scorecard — RadVault PACS

**Evaluator:** Claude Sonnet 4.6 (automated code review)
**Date:** 2026-03-04 (re-evaluation after commits ea7cac6, 88956ee)
**Candidate:** Noah

Scale: 1 = Insufficient | 2 = Adequate | 3 = Strong | 4 = Exceptional

---

## Dimension 1: Architecture & Design Patterns (30%)

### Sub-Dimension Scores

| Sub-Dimension                            | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Domain modeling (DICOM hierarchy)        | 4     | Patient→Study→Series→Instance hierarchy modeled precisely in `schema.prisma`. All nine DICOM UIDs stored as plain strings per spec. `orthancStudyId`/`orthancSeriesId`/`orthancInstanceId` kept as separate columns with documented rationale. JSONB `dicomTags` for extensibility. Instance `rows`/`columns` now populated at STOW-RS time (`dicom.service.ts:417-428`) and returned in QIDO-RS instance responses (`dicom.service.ts:177-194`). Indexing strategy documented for all QIDO filter columns.                                                                                                                               |
| Service boundary design                  | 4     | Modular monolith with five discrete modules (DicomModule, WorklistModule, ReportModule, AuthModule, AuditModule) plus InternalModule for Orthanc callback. Modules communicate via injected service interfaces only — no cross-module direct imports. BullMQ worker is a separate Node process for CPU-heavy thumbnail work. Architecture document explicitly justifies modular monolith over microservices with concrete reasoning.                                                                                                                                                                                                         |
| API contract quality (DICOMweb + custom) | 3     | DICOMweb endpoints: STOW-RS, QIDO-RS (studies/series/instances with correct DICOM JSON tag encoding), WADO-RS (via Orthanc with auth callback). Custom REST for auth, worklist, reports, users, audit. OpenAPI spec auto-generated via `@nestjs/swagger`. `application/dicom+json` content-type set correctly. QIDO wildcard now uses `startsWith` (correct DICOM prefix semantics). Missing: API versioning (`/v1/` prefix absent), `includefield` parameter, QIDO pagination uses `page` not `offset` per spec.                                                                                                                        |
| Separation of concerns                   | 4     | Each module has controller/service/DTO layers. AuditService is cross-cutting but injected, not global state. Stream piping in DicomService keeps NestJS as a traffic director — no pixel buffering. Transaction boundaries explicit in `$transaction()` calls. Orthanc callback controller correctly isolated in InternalModule. Report signing triggers worklist transition via `worklistService.transition()` in the same Prisma transaction — cross-module coordination done correctly.                                                                                                                                                 |
| Requirements document quality            | 4     | `templates/REQUIREMENTS.md` (58KB) covers: technology stack with per-choice rationale, data model with full ERD and justifications (UUID PKs for enumeration defense, JSONB for extensibility, indexing strategy for QIDO columns, REPORT_VERSION dual-purpose), security architecture with sequence diagrams, infrastructure/cloud architecture, appendix with all major technology comparisons. Rivals a production RFC in depth.                                                                                                                                                                                                        |
| Trade-off awareness                      | 4     | Explicit comparisons documented: OHIF vs Cornerstone3D (application shell conflict), microservices vs monolith (operational overhead), GCP Cloud Run vs ECS Fargate (cold start issue for Orthanc in-memory index), MongoDB vs PostgreSQL (worklist transaction requirements), argon2 vs bcrypt (Alpine glibc native build risk), WADO-RS proxy vs direct (throughput bottleneck). Each rejected option has a concrete, specific reason.                                                                                                                                                                                                  |

**Dimension 1 Score: 4**

**Justification:** Unchanged from first evaluation. Architecture documentation is exceptional in breadth and analytical depth. DICOM data model is precise, service boundaries are clean and enforced by code structure. Instance `rows`/`columns` are now fully populated (removes the only minor data model gap from the first evaluation). The WADO-RS proxying via Orthanc callback is a sophisticated production-grade pattern. API versioning absence is a minor gap that doesn't change the dimension score.

---

## Dimension 2: Full-Stack Implementation (25%)

### Sub-Dimension Scores

| Sub-Dimension                                               | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| End-to-end workflow works (ingest → search → view → report) | 4     | Full workflow verifiable from code: upload via Studies page → STOW-RS pipe to Orthanc → metadata indexing + worklist creation → QIDO query returns study → click-through to CornerstoneViewer loading WADO-RS frames → Radiologist claims in Worklist → creates/edits report (now in Tiptap) → signs Preliminary → signs Final (auto-transitions worklist). Each step is connected and transactionally sound.                                                                                                                                                                                              |
| Backend code quality (type safety, error handling)          | 4     | TypeScript throughout with strict typing. Shared `@radvault/types` package ensures API/frontend consistency. Error handling uses correct NestJS exception classes throughout. Global exception filter present. QIDO wildcard **fixed** — now uses `startsWith` with wildcard stripping (`dicom.service.ts:481-488`), not substring matching. Instance `rows`/`columns` **fixed** — populated during STOW-RS and returned in DICOM JSON. `void` used correctly for fire-and-forget audit calls.                                                                                                             |
| Frontend UX (study browser, viewer, reporting)              | 4     | Study browser: sortable, filterable, paginated table with thumbnails and status badges. Viewer: Cornerstone3D with four clinically correct W/L presets, Pan/Zoom/Length tools, series panel, mouse wheel + keyboard scroll. Reporting: side-by-side viewer + **Tiptap rich text editor** (Bold, Italic, Bullet List, Ordered List toolbar — `components/editor/rich-text-editor.tsx`), auto-save indicator, all sign/amend actions. Dark theme with consistent shadcn/ui components. Still missing: multi-viewport (MAY), responsive layout xl-breakpoint only (SHOULD).                                  |
| Test quality (behavior vs. execution)                       | 4     | **Significantly upgraded in 88956ee.** Unit tests: 927 lines across 3 files (worklist/report/auth state machines). Integration tests: 3 spec files (`apps/api/test/`) running against a real PostgreSQL instance via `bootstrapIntegrationApp()`: (1) `auth.integration.spec.ts` — 6 tests covering login/refresh/me/unauthorized; (2) `dicom-worklist.integration.spec.ts` — 5 tests covering DICOM upload, QIDO query, worklist transitions (Orthanc-conditional); (3) `report-lifecycle.integration.spec.ts` — 12 tests covering full report lifecycle + RBAC enforcement for all roles + ReferringPhysician scoping. CI `integration-test` job runs these against real PostgreSQL. Tests verify behavior, not just execution. |
| Edge case handling                                          | 3     | Refresh token reuse detection revokes entire family. ReferringPhysician scope enforced at query level. Duplicate study upload handled via `upsert`. Orthanc startup handled with `waitForApiHealth` retry loop. STOW-RS content-type validated. Audit log write failures non-fatal. Missing: no rate limiting, no request timeout, no study-level concurrent modification protection.                                                                                                                                                                                                                       |

**Dimension 2 Score: 4** (upgraded from 3)

**Justification:** All four blockers cited in the first evaluation have been resolved:

1. Integration tests against real PostgreSQL — three spec files (auth, DICOM+worklist, report lifecycle) all running against a real database ✅
2. Rich text editing (Tiptap with Bold, Italic, Bullet List, Ordered List) for all five report sections ✅
3. True DICOM wildcard matching (`DOE*` → `startsWith('DOE')`) ✅
4. Instance `rows` and `columns` stored and returned in DICOM JSON ✅

The remaining gaps (no multi-viewport, xl-only responsive layout, no rate limiting) are all MAY-or-not-in-rubric items that do not block a 4.

---

## Dimension 3: DevOps & Infrastructure (20%)

### Sub-Dimension Scores

| Sub-Dimension             | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Docker Compose experience | 4     | Ten services with explicit dependency ordering and health check conditions (`depends_on.service.condition: service_healthy`). Entrypoint: migrate → push → start API background → seed (with health retry loop) → foreground wait. Named volumes on all stateful services. minio-init container creates the bucket automatically. Orthanc S3 plugin configured via environment variables. Clean `docker compose up` with fully seeded, ready-to-demo state. |
| Dockerfile quality        | 4     | Multi-stage builds for all three images (builder + runner). Production image uses `node:24-alpine`, copies only dist + production node_modules. `--omit=dev` for production deps. `RUN apk add openssl curl` for Prisma. `USER node` for non-root. **`.dockerignore` added in ea7cac6** — correctly excludes `node_modules`, `**/node_modules`, `**/dist`, `**/.next`, `**/.turbo`, `**/coverage`, `.git`, `.gitignore`, `.vscode`, `*.log`, `.env*` (with `!.env.example`). Layer caching still suboptimal (no separate npm install step before source copy). |
| IaC quality               | 4     | Six Terraform modules: networking (VPC, subnets, security groups, ALB), storage (S3 with versioning), database (RDS PostgreSQL Multi-AZ capable), cache (ElastiCache Redis), compute (ECS Fargate task defs for all four services), monitoring (CloudWatch log groups, SNS alarms). SSM Parameter Store for JWT keys and DB password. `skip_credentials_validation = true` enables `terraform validate` without AWS auth. |
| CI/CD pipeline            | 4     | **Significantly upgraded in 88956ee.** Five jobs: lint-and-typecheck → security-scan (`npm audit --audit-level=high`) → test (postgres+redis services, coverage artifact) → integration-test (dedicated job: runs `apps/api/test/` against real PostgreSQL) → build (docker compose config validation) → docker-build (main push only). No registry push or deploy step (expected for a no-secrets CI environment). |
| Observability             | 4     | **Fixed in 88956ee.** Winston JSON logging in ALL environments (no conditional on `NODE_ENV`). `/health` and `/ready` with real DB/Redis checks. Prometheus `/metrics` via `@willsoto/nestjs-prometheus`. OpenTelemetry auto-instrumentation to Jaeger. Grafana with Prometheus datasource auto-provisioned **and** pre-built `radvault.json` dashboard (HTTP Request Rate, HTTP Error Rate, Node.js heap usage, process CPU timeseries). |
| Secrets hygiene           | 4     | No hardcoded secrets in code. `.env` in .gitignore. `terraform.tfvars.example` with placeholder values. Terraform SSM references. JWT keys passed via environment variables from Compose. `.dockerignore` correctly excludes `.env*` from build context.                                                                                                                                               |

**Dimension 3 Score: 4** (upgraded from 3)

**Justification:** All three blockers cited in the first evaluation have been resolved:

1. Security scanning step in CI — `security-scan` job with `npm audit --audit-level=high` ✅
2. Pre-built Grafana dashboard JSON — 226-line `radvault.json` with 4+ panels auto-provisioned ✅
3. JSON logging in all environments — logger.ts always uses `winston.format.json()` ✅

Additionally: `.dockerignore` properly configured (ea7cac6), integration-test CI job added. The only remaining gap (no registry push, no deploy step) is expected and typical for a demo environment without a registry configured — not a scoring concern.

---

## Dimension 4: AI-Assisted Development (15%)

### Sub-Dimension Scores

| Sub-Dimension                          | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Retrospective depth and honesty        | 4     | **Significantly upgraded in 88956ee.** Now includes two verbatim prompt examples: (1) Full WorklistModule prompt — 8 bullet-point constraints including state machine specification, cross-module source flag, and AuditService integration; (2) Cornerstone3D hook prompt — 7 bullet requirements specifying exact API version (v2.x), WADO-RS imageId pattern, WORKER_JWT injection, and explicit deprecation avoidance. For each example: shows what was produced, what the prompt was missing, and the corrected prompt. The auth callback section explicitly identifies that "deny-by-default was not stated" as the root cause of the permissive output — demonstrating genuine prompt analysis, not just storytelling. |
| Strategy sophistication                | 3     | Two-phase approach (architecture before code) is explicitly structured and demonstrably practiced. Context7 MCP for live API docs is a specific, non-obvious strategy. Step-boundary human reviews tied to acceptance criteria are process discipline. Concrete prompts show the "constrained + acceptance criteria" approach in practice. Missing from 4: no mention of chain-of-thought, few-shot techniques, or agent orchestration patterns. The iterative prompt-fix cycle (initial → failure → explicit correction) is described but not labeled as a formal pattern.                                   |
| Evidence in code (AI-assisted quality) | 3     | Consistent code style across all modules. AI-generated boilerplate reviewed at step gates — no style inconsistencies. Retrospective accurately identifies what AI got wrong (auth gaps, startup sequencing), which is validated by code showing manual corrections (`source='controller'` restriction, RBAC guards). Velocity analysis breakdown (45% as-is, 40% human-edited, 15% human-written) is credible given the 15.25h total.                                                                                                                                                                       |
| Time velocity                          | 3     | 15.25 hours for full-stack PACS with worklist, reporting, viewer, auth, IaC, CI, seed data is very high velocity. Phase breakdown (2.75h requirements, 12.5h implementation) is realistic with AI assistance. Post-submission fixes (rich text editor, integration tests, Grafana dashboard, security scan CI) added in roughly ~2h of targeted work, demonstrating continued AI-assisted iteration velocity.                                                                                                                                                                                                 |

**Dimension 4 Score: 3** (strong 3, improved evidence quality)

**Justification:** The retrospective is materially better with actual verbatim prompt examples showing the "constrained + acceptance criteria" approach in practice, including analysis of failure modes. Two of the three "what would make it a 4" criteria have been met. The remaining gap (no discussion of chain-of-thought, few-shot, or agent orchestration) keeps this from a 4. Strategy sophistication and evidence in code remain at 3. The dimension score is at the top of the 3 band.

**What would make it a 4:**
- Discussion of multi-step agent orchestration (e.g., "I chained three prompts to build the auth module: schema → service → guards") or multi-turn context management
- Mention of chain-of-thought or few-shot techniques applied to specific problems
- AI tool comparison (why Claude over GitHub Copilot autocomplete for this type of task)

---

## Dimension 5: Domain Understanding (10%)

### Sub-Dimension Scores

| Sub-Dimension                 | Score | Evidence                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DICOM hierarchy and UIDs      | 4     | StudyInstanceUID (0020000D), SeriesInstanceUID (0020000E), SOPInstanceUID (00080018), SOPClassUID (00080016), PatientID (00100020), PatientName (00100010), StudyDate (00080020), Modality (00080060), ModalitiesInStudy (00080061), AccessionNumber (00080050) — all referenced by correct hex codes in `dicom.service.ts`. Person Name VR handled correctly. Date VR (DA) formatted as YYYYMMDD. |
| Clinical workflow correctness | 4     | Worklist state machine: Scheduled (new study arrives) → InProgress (radiologist claims) → Preliminary (draft sign) → Final (final sign) → Amended (post-signature correction). Matches clinical radiology workflow exactly. Report status synchronized with worklist via cross-module Prisma transaction. Technologist uploads → Radiologist reads → Referring Physician views reports = correct role delineation. |
| HIPAA awareness               | 4     | PHI access logged on every QIDO query, WADO-RS request (via Orthanc callback), and report access. Audit log is append-only (verified in code — no UPDATE/DELETE on audit_logs). Failed auth attempts return 401 without revealing whether user exists. IP address logged with X-Forwarded-For parsing. Referring Physician scoped to own patients only, enforced at query level and validated by integration test. |
| Viewer windowing accuracy     | 4     | Lung: lower=-1350, upper=150. Bone: lower=-600, upper=1400. Soft Tissue: lower=-160, upper=240. Brain: lower=0, upper=80. All four presets are clinically standard and consistent with PACS conventions.                                                                                                                                                                                                      |
| Domain vocabulary             | 4     | Correct use of: STOW-RS, QIDO-RS, WADO-RS, SOP Class, SOP Instance, modality, worklist, preliminary vs. final signature, addendum, accession number, referring physician, DICOM tags (using VR terminology). Architecture document correctly explains DICOM hierarchy, DICOMweb protocol, and HIPAA considerations with accurate medical imaging terminology.                                                  |

**Dimension 5 Score: 4** (unchanged)

**Note:** Technologist WADO-RS viewing restriction (orthanc-callback denies Technologist GET) remains. In most real-world PACS, technologists review acquired images for QC. The requirements spec is ambiguous on this point. The architecture document acknowledges this as a simplification. Not sufficient to drop to 3.

---

## Summary Table

| #         | Dimension                      | Weight   | Old Score | New Score | Old Weighted | New Weighted |
| --------- | ------------------------------ | -------- | --------- | --------- | ------------ | ------------ |
| 1         | Architecture & Design Patterns | 30%      | 4         | 4         | 1.20         | 1.20         |
| 2         | Full-Stack Implementation      | 25%      | 3         | 4         | 0.75         | 1.00         |
| 3         | DevOps & Infrastructure        | 20%      | 3         | 4         | 0.60         | 0.80         |
| 4         | AI-Assisted Development        | 15%      | 3         | 3         | 0.45         | 0.45         |
| 5         | Domain Understanding           | 10%      | 4         | 4         | 0.40         | 0.40         |
| **Final** |                                | **100%** |           |           | **3.40**     | **3.85**     |

**Band: Strong Hire** (≥3.5)

### Score movement rationale:

**Dimension 2: 3→4** — All four previously stated blockers fixed: integration tests (3 HTTP-layer spec files against real PostgreSQL), Tiptap rich text editor, QIDO prefix wildcard, Instance rows/columns.

**Dimension 3: 3→4** — All three previously stated blockers fixed: `npm audit` security scan in CI, pre-built Grafana dashboard JSON, JSON logging in all environments.

**Dimension 4: 3→3** — Two of three blockers addressed (verbatim prompt examples, specific prompting pattern analysis). Chain-of-thought/agent orchestration still absent. Sub-dimensions "evidence in code" and "time velocity" unchanged at 3. Overall dimension stays at 3 (now a strong 3).
