# RadVault - Architecture Document

**Author:** Noah
**Date:** 2026-03-01

---

## System Overview

### High-Level Architecture

```mermaid
graph TD
    Browser[Web Browser<br/>Next.js SPA + Cornerstone3D]

    subgraph ALB[Application Load Balancer]
        direction LR
        R1["/api/* → NestJS"]
        R2["/dicom-web/wado-rs/* → Orthanc"]
    end

    subgraph Internal Network
        NestJS[NestJS<br/>Modular Monolith]
        Orthanc[Orthanc<br/>DICOM Server]
        BullWorker[BullMQ Worker<br/>Thumbnail / Worklist Jobs]
        Redis[(Redis<br/>Job Queue + Cache)]
        PostgreSQL[(PostgreSQL<br/>Metadata, Worklist,<br/>Reports, Audit)]
        MinIO[(MinIO / S3<br/>DICOM Pixel Data<br/>+ Thumbnails)]
    end

    subgraph Observability
        Prometheus[Prometheus]
        Grafana[Grafana]
        Jaeger[Jaeger / X-Ray]
    end

    Browser -->|REST API calls| R1
    Browser -->|WADO-RS pixel retrieval| R2

    R1 --> NestJS
    R2 --> Orthanc

    NestJS -->|STOW-RS stream pipe| Orthanc
    NestJS -->|Metadata CRUD| PostgreSQL
    NestJS -->|Enqueue jobs| Redis
    NestJS -->|Auth callback| Orthanc

    Orthanc -->|Authorization check<br/>on every WADO-RS request| NestJS
    Orthanc -->|Store/retrieve pixels| MinIO

    BullWorker -->|Consume jobs| Redis
    BullWorker -->|Fetch rendered frame| Orthanc
    BullWorker -->|Store thumbnails| MinIO
    BullWorker -->|Update thumbnail path| PostgreSQL

    NestJS -->|Metrics| Prometheus
    NestJS -->|Traces| Jaeger
    Prometheus --> Grafana
```

### Description

**Modular monolith over microservices.** I'm running one NestJS process with five modules, built into a single container image. microservices got nixed for two reasons:

1. Operational overhead at this scale is unjustifiable. five services means five Dockerfiles, five CI pipelines, five ecs task defs for workflows that span DICOM ingest and worklist creation. for a few bounded contexts and a tiny team, that kills velocity.

2. Cross-cutting concerns are way easier in-process. auth guards, audit interceptors, transactions all live in Nest's DI. with microservices i'd either copy auth logic everywhere or add it behind an api gateway with shared middleware.

The modular monolith still lets me extract modules out later. each module has its own service layer, controller layer, and Prisma queries, and module internals don't import each other directly, only talk through exported service interfaces.

**Service boundaries inside the monolith:**

- **DicomModule:** stow-rs ingest (stream piping to orthanc), qido-rs queries, metadata persistence, thumbnail job dispatch
- **WorklistModule:** worklist state machine, assignment, status transitions with validation
- **ReportModule:** report CRUD, section management, signing workflow, pdf generation
- **AuthModule:** jwt issuance, refresh token rotation, password hashing, rbac guard
- **AuditModule:** append-only audit writes, admin-facing audit query endpoints

Communication patterns: modules talk in-process via injected services. externals are http to orthanc's DICOMweb and s3-compatible calls to minio. bullmq workers run in a separate node process so cpu-heavy thumbnail work doesn't intervene the api event loop.

Nestjs treats orthanc like infra, basically a database, not a peer service. it offloads all the messy dicom stuff to orthanc. nestjs itself doesn't care about the dicom wire format. it talks to orthanc over REST and to its own postgres schema. keeps the dicom protocol mess tucked behind one http client in dicommodule, so swapping orthanc for another dicomweb server only means changing that module.

---

## Data Model

### Entity-Relationship Diagram

```mermaid
erDiagram
    PATIENT {
        uuid id PK
        string patient_id "DICOM Patient ID"
        string patient_name
        date patient_birth_date
        string patient_sex
        timestamp created_at
        timestamp updated_at
    }

    STUDY {
        uuid id PK
        uuid patient_id FK
        string study_instance_uid UK "DICOM Study Instance UID"
        string accession_number
        string study_description
        date study_date
        time study_time
        string modalities_in_study
        string referring_physician_name
        string institution_name
        int number_of_series
        int number_of_instances
        string orthanc_study_id "Orthanc internal ID"
        string thumbnail_path "MinIO path to thumbnail"
        jsonb dicom_tags "Additional DICOM tags"
        timestamp created_at
        timestamp updated_at
    }

    SERIES {
        uuid id PK
        uuid study_id FK
        string series_instance_uid UK "DICOM Series Instance UID"
        string series_description
        string modality
        int series_number
        int number_of_instances
        string orthanc_series_id
        jsonb dicom_tags
        timestamp created_at
    }

    INSTANCE {
        uuid id PK
        uuid series_id FK
        string sop_instance_uid UK "DICOM SOP Instance UID"
        string sop_class_uid
        int instance_number
        string orthanc_instance_id
        timestamp created_at
    }

    WORKLIST_ITEM {
        uuid id PK
        uuid study_id FK
        uuid assigned_to FK "User ID of assigned radiologist"
        string status "Scheduled|InProgress|Preliminary|Final|Amended"
        string priority "Stat|Urgent|Routine"
        timestamp scheduled_at
        timestamp started_at
        timestamp completed_at
        timestamp created_at
        timestamp updated_at
    }

    REPORT {
        uuid id PK
        uuid study_id FK
        uuid author_id FK
        string status "Draft|Preliminary|Final|Amended|Addended"
        text indication
        text technique
        text comparison
        text findings
        text impression
        uuid signed_by FK
        timestamp signed_at
        int version
        timestamp created_at
        timestamp updated_at
    }

    REPORT_VERSION {
        uuid id PK
        uuid report_id FK
        int version_number
        text indication
        text technique
        text comparison
        text findings
        text impression
        uuid author_id FK
        string status_at_version
        timestamp created_at
    }

    USER {
        uuid id PK
        string email UK
        string password_hash
        string full_name
        string role "Admin|Radiologist|Technologist|ReferringPhysician"
        boolean is_active
        timestamp last_login_at
        timestamp created_at
        timestamp updated_at
    }

    REFRESH_TOKEN {
        uuid id PK
        uuid user_id FK
        string token_hash UK
        string family_id "Token family for rotation detection"
        boolean is_revoked
        timestamp expires_at
        timestamp created_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid user_id FK "Nullable for system events"
        string action "STUDY_VIEW|REPORT_SIGN|LOGIN|etc"
        string resource_type "Study|Report|User|etc"
        uuid resource_id
        string ip_address
        string user_agent
        jsonb details "Additional context"
        timestamp created_at
    }

    PATIENT ||--o{ STUDY : "has"
    STUDY ||--o{ SERIES : "contains"
    SERIES ||--o{ INSTANCE : "contains"
    STUDY ||--o| WORKLIST_ITEM : "assigned via"
    STUDY ||--o{ REPORT : "reported in"
    REPORT ||--o{ REPORT_VERSION : "versioned as"
    USER ||--o{ REPORT : "authors"
    USER ||--o{ WORKLIST_ITEM : "assigned to"
    USER ||--o{ AUDIT_LOG : "generates"
    USER ||--o{ REFRESH_TOKEN : "holds"
```

### Design Decisions

**UUIDs as primary keys** instead of serial integers. Resource IDs are exposed in API paths (`/api/reports/:id`, `/api/worklist/:id`), and sequential integers invite enumeration attacks - an attacker can trivially iterate over `/api/reports/1`, `/api/reports/2`, etc. to probe for accessible resources. UUIDs eliminate that attack surface. They're also safe to generate client-side if needed (e.g., for optimistic inserts) and carry no coupling to insertion order, which matters if data is ever migrated or merged across environments.

**DICOM UID mapping:** `study_instance_uid`, `series_instance_uid`, and `sop_instance_uid` are stored as plain strings - not parsed, not validated beyond non-empty. These are the DICOM-standard globally unique identifiers that the DICOMweb protocol uses for addressing. Alongside them, Orthanc's internal IDs (`orthanc_study_id`, `orthanc_series_id`, `orthanc_instance_id`) are stored as separate columns. The two ID spaces are kept separate deliberately: DICOM UIDs are used in API paths and client-facing queries (QIDO-RS, WADO-RS), while Orthanc IDs are used exclusively for internal REST calls to Orthanc's API (e.g., fetching metadata, retrieving rendered frames). This separation means the application never conflates the two, and replacing Orthanc would only require updating the Orthanc ID columns and the DicomModule HTTP client.

**JSONB `dicom_tags` column** on STUDY and SERIES stores the full DICOM tag set beyond the explicitly indexed columns. This enables flexible queries (e.g., filtering by InstitutionName or BodyPartExamined) without schema migrations for every new tag. The JSONB column is not indexed by default - only when a tag becomes a common query filter would it be promoted to a dedicated indexed column. This keeps write performance high during ingest while preserving query flexibility.

**Indexing strategy:** These are the columns that appear in WHERE clauses and JOIN conditions for QIDO-RS queries, worklist queries, and audit log queries:

- `study`: `study_date`, `modality`, `referring_physician_name`, `accession_number` (QIDO-RS filter columns)
- `study`: `patient_id` FK (patient → study traversal joins)
- `worklist_item`: `status`, `assigned_to` (worklist query filters)
- `audit_log`: composite index on `(user_id, created_at)` (audit query filters - supports both user-scoped and time-range queries efficiently)
- `patient`: `patient_id` (deduplication lookup on ingest)
- `series`: `study_id` FK, `modality` (series-level QIDO-RS filters)

All other columns are unindexed unless query profiling shows otherwise.

**REPORT_VERSION alongside REPORT.version:** The `version` field on REPORT tracks the current version number and serves as an optimistic concurrency control token - clients send the version they last read, and the update is rejected if it has since changed. REPORT_VERSION stores immutable snapshots of the full report content at each version, so the complete edit history can be reconstructed independently of the live REPORT record. This dual approach means the live record stays lean for reads while the version table provides a complete audit trail. The two are complementary, not redundant: REPORT.version is for concurrency control, REPORT_VERSION is for historical reconstruction.

---

## Request Flow Diagrams

### DICOM Ingestion Flow

```mermaid
sequenceDiagram
    participant Client as DICOM Client
    participant NestJS as NestJS API
    participant Orthanc as Orthanc DICOM Server
    participant PG as PostgreSQL
    participant Redis as BullMQ / Redis
    participant Worker as BullMQ Worker
    participant MinIO as MinIO / S3

    Client->>NestJS: POST /api/dicom-web/studies<br/>multipart/related stream
    Note over NestJS: Auth guard validates JWT
    Note over NestJS: Stream pipe - no buffering
    NestJS->>Orthanc: POST /dicom-web/studies<br/>piped multipart/related stream
    Note over Orthanc: Parse DICOM, store pixels
    Orthanc->>MinIO: Store pixel data via S3 plugin
    Orthanc-->>NestJS: 200 OK + DICOM JSON response<br/>(stored instance UIDs)
    Note over NestJS: Parse Orthanc response for metadata
    NestJS->>Orthanc: GET /studies/{id}/metadata<br/>(fetch full DICOM tags)
    Orthanc-->>NestJS: DICOM metadata JSON
    NestJS->>PG: Upsert Patient, Study, Series, Instance
    NestJS->>PG: Create WorklistItem (status: Scheduled)
    NestJS->>Redis: Enqueue thumbnail job
    NestJS-->>Client: 200 OK + STOW-RS response
    Redis-->>Worker: Thumbnail job dequeued
    Worker->>Orthanc: GET /instances/{id}/rendered
    Orthanc-->>Worker: Rendered JPEG frame
    Worker->>Worker: sharp resize to 256x256
    Worker->>MinIO: Store thumbnail
    Worker->>PG: Update study.thumbnail_path
```

**Stream piping is the critical design choice here.** When a STOW-RS request arrives at NestJS, the incoming `multipart/related` request body is piped directly to Orthanc's STOW-RS endpoint as a Node.js readable stream. NestJS never buffers the full multipart body in memory. This is essential because a single CT study can contain 500+ slices at 512x512 resolution, easily exceeding 500MB. If NestJS buffered the entire payload before forwarding to Orthanc, a handful of concurrent uploads would exhaust the container's memory allocation and crash the process. Stream piping keeps NestJS memory usage constant regardless of study size - it processes data in chunks as it flows through.

**NestJS is a traffic director, not a relay.** Its responsibilities during ingest are: (1) authenticate the request, (2) pipe the stream to Orthanc, (3) wait for Orthanc's confirmation, (4) extract metadata from the confirmation response, (5) write metadata to PostgreSQL, (6) enqueue async jobs. At no point does NestJS own, parse, or hold pixel data. The sequencing is deliberate - metadata writes and job enqueues happen only after Orthanc confirms successful storage, so a failed Orthanc write does not leave orphaned metadata rows in PostgreSQL.

**Metadata extraction happens from Orthanc's response and a follow-up metadata query, not from parsing the incoming DICOM stream.** This avoids duplicating DICOM parsing logic and ensures the metadata in PostgreSQL matches exactly what Orthanc stored.

### Study Viewing Flow

```mermaid
sequenceDiagram
    participant R as Radiologist Browser
    participant ALB as ALB
    participant NestJS as NestJS
    participant Orthanc as Orthanc
    participant PG as PostgreSQL
    participant MinIO as MinIO / S3

    R->>ALB: GET /api/worklist?status=Scheduled&sort=priority_desc
    ALB->>NestJS: Forward request
    NestJS->>PG: Query worklist_items JOIN studies JOIN patients
    PG-->>NestJS: Paginated worklist with study metadata
    NestJS-->>R: Worklist items + thumbnail URLs

    R->>ALB: PATCH /api/worklist/:id/status { status: "InProgress" }
    ALB->>NestJS: Forward request
    Note over NestJS: Validate state transition<br/>Scheduled → InProgress
    NestJS->>PG: UPDATE worklist_item SET status, started_at
    NestJS->>PG: INSERT audit_log (WORKLIST_CLAIM)
    NestJS-->>R: Updated worklist item

    R->>ALB: GET /api/dicom-web/studies/{studyUID}/series
    ALB->>NestJS: Forward request
    NestJS->>PG: Query series metadata by study
    NestJS-->>R: Series list with metadata

    Note over R,MinIO: Pixel retrieval is DIRECT -<br/>browser to Orthanc, NOT through NestJS

    R->>ALB: GET /dicom-web/wado-rs/studies/{uid}/series/{uid}/instances/{uid}/frames/1<br/>Authorization: Bearer {jwt}
    ALB->>Orthanc: Forward to Orthanc (ALB path-based routing)

    Note over Orthanc,NestJS: Server-to-server auth callback<br/>(internal network, not through ALB)
    Orthanc->>NestJS: POST /internal/orthanc/authorize<br/>{ method, uri, headers: { authorization } }
    NestJS->>NestJS: Validate JWT, check RBAC
    NestJS->>PG: INSERT audit_log (STUDY_VIEW)
    NestJS-->>Orthanc: 200 OK (allow)

    Orthanc->>MinIO: Fetch pixel data by S3 key
    MinIO-->>Orthanc: DICOM pixel data
    Orthanc-->>R: multipart/related DICOM frames
```

The browser never touches the audit path. Audit enforcement is a server-to-server control between Orthanc and NestJS via the authorization plugin callback. This is why direct browser → Orthanc pixel access does not bypass HIPAA audit requirements - every WADO-RS request triggers the callback, and NestJS writes the audit log entry before returning the allow decision. If JWT validation fails or RBAC denies access, Orthanc returns 403 to the browser without serving any pixel data.

### Reporting Flow

```mermaid
sequenceDiagram
    participant R as Radiologist Browser
    participant NestJS as NestJS
    participant PG as PostgreSQL

    Note over R,PG: 1. Create Draft
    R->>NestJS: POST /api/reports<br/>{ studyId, indication, technique,<br/>comparison, findings, impression }
    NestJS->>PG: INSERT report (status: Draft, version: 1)
    NestJS->>PG: INSERT report_version (version_number: 1)
    NestJS->>PG: INSERT audit_log (REPORT_CREATE)
    NestJS-->>R: Created report

    Note over R,PG: 2. Edit Draft (one or more times)
    R->>NestJS: PUT /api/reports/:id<br/>{ findings, impression }
    Note over NestJS: Only allowed while status = Draft
    NestJS->>PG: UPDATE report (version++, content fields)
    NestJS->>PG: INSERT report_version (new snapshot)
    NestJS->>PG: INSERT audit_log (REPORT_UPDATE)
    NestJS-->>R: Updated report

    Note over R,PG: 3. Sign Preliminary
    R->>NestJS: POST /api/reports/:id/sign<br/>{ status: "Preliminary" }
    NestJS->>PG: UPDATE report (status: Preliminary,<br/>signed_by, signed_at)
    NestJS->>PG: INSERT report_version (snapshot)
    NestJS->>PG: INSERT audit_log (REPORT_SIGN_PRELIMINARY)
    NestJS->>PG: UPDATE worklist_item (status: Preliminary)
    NestJS-->>R: Signed report

    Note over R,PG: 4. Sign Final
    R->>NestJS: POST /api/reports/:id/sign<br/>{ status: "Final" }
    NestJS->>PG: UPDATE report (status: Final)
    NestJS->>PG: INSERT report_version (snapshot)
    NestJS->>PG: INSERT audit_log (REPORT_SIGN_FINAL)
    NestJS->>PG: UPDATE worklist_item (status: Final)
    NestJS-->>R: Finalized report

    Note over R,PG: 5. Amend (creates NEW report record)
    R->>NestJS: POST /api/reports/:id/amend<br/>{ findings, impression }
    Note over NestJS: Final report is permanently immutable.<br/>Amendment creates a new report record.
    NestJS->>PG: INSERT new report (status: Amended,<br/>same study_id, version: 1)
    NestJS->>PG: INSERT report_version (snapshot for new report)
    NestJS->>PG: INSERT audit_log (REPORT_AMEND)
    NestJS->>PG: UPDATE worklist_item (status: Amended)
    NestJS-->>R: Amended report (new record)
```

Every state transition writes both a REPORT_VERSION snapshot and an AUDIT_LOG entry. The full edit history of any report can be reconstructed from audit_log alone, independent of the REPORT_VERSION table. The Final report is permanently immutable after signing - amendment creates a new report record linked to the same study, it does not mutate the Final report.

---

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    participant Browser
    participant NestJS
    participant PG as PostgreSQL

    Note over Browser,PG: Login Flow
    Browser->>NestJS: POST /api/auth/login { email, password }
    NestJS->>PG: Fetch user by email
    PG-->>NestJS: User record with password_hash
    NestJS->>NestJS: bcrypt.compare(password, hash)
    NestJS->>PG: Create RefreshToken (family_id = new UUID)
    NestJS->>PG: INSERT audit_log (LOGIN)
    NestJS-->>Browser: { accessToken (15m), refreshToken (7d), user }

    Note over Browser,PG: Token Refresh (Rotation)
    Browser->>NestJS: POST /api/auth/refresh { refreshToken }
    NestJS->>PG: Lookup token by hash, check not revoked
    NestJS->>PG: Revoke old refresh token
    NestJS->>PG: Create new RefreshToken (same family_id)
    NestJS-->>Browser: { new accessToken, new refreshToken }

    Note over Browser,PG: Reuse Detection
    Browser->>NestJS: POST /api/auth/refresh { old refreshToken }
    NestJS->>PG: Token found but already revoked
    NestJS->>PG: Revoke ALL tokens in this family_id
    NestJS->>PG: INSERT audit_log (TOKEN_REUSE_DETECTED)
    NestJS-->>Browser: 401 Unauthorized
```

### Authorization Matrix

| Action                    | Admin | Radiologist        | Technologist | Referring Physician    |
| ------------------------- | ----- | ------------------ | ------------ | ---------------------- |
| Upload studies (STOW-RS)  | ✅    | ❌                 | ✅           | ❌                     |
| Search studies (QIDO-RS)  | ✅    | ✅                 | ✅           | ✅ (own patients only) |
| View images (WADO-RS)     | ✅    | ✅                 | ✅           | ✅ (own patients only) |
| View study metadata       | ✅    | ✅                 | ✅           | ✅ (own patients only) |
| Create report (draft)     | ❌    | ✅                 | ❌           | ❌                     |
| Edit report (draft)       | ❌    | ✅ (author only)   | ❌           | ❌                     |
| Sign report (preliminary) | ❌    | ✅                 | ❌           | ❌                     |
| Sign report (final)       | ❌    | ✅                 | ❌           | ❌                     |
| Amend signed report       | ❌    | ✅                 | ❌           | ❌                     |
| View reports              | ✅    | ✅                 | ❌           | ✅ (own patients only) |
| Manage worklist (assign)  | ✅    | ❌                 | ❌           | ❌                     |
| Update worklist status    | ✅    | ✅ (assigned only) | ❌           | ❌                     |
| Manage users              | ✅    | ❌                 | ❌           | ❌                     |
| View audit logs           | ✅    | ❌                 | ❌           | ❌                     |
| System configuration      | ✅    | ❌                 | ❌           | ❌                     |

**Referring Physicians** are scoped to studies where they are listed as the referring physician in the DICOM metadata (`ReferringPhysicianName` tag). This is enforced at the query level - the service layer adds a WHERE clause filtering by the referring physician's name. This is a simplification; a production system would need a more robust patient-physician relationship model.

**Technologists** can upload and search but cannot create reports or view existing reports. They interact with the PACS for ingestion and quality control, not for diagnostic interpretation.

---

## Infrastructure

### Cloud Deployment Architecture

```mermaid
graph TD
    Internet[Internet]

    subgraph AWS VPC
        subgraph Public Subnet
            ALB[Application Load Balancer<br/>TLS termination]
        end

        subgraph Private Subnet A
            ECS_API[ECS Fargate<br/>NestJS API]
            ECS_Worker[ECS Fargate<br/>BullMQ Worker]
            ECS_Orthanc[ECS Fargate<br/>Orthanc]
            ECS_Frontend[ECS Fargate<br/>Next.js]
        end

        subgraph Private Subnet B
            RDS[(RDS PostgreSQL 15<br/>Multi-AZ)]
            ElastiCache[(ElastiCache Redis<br/>Cluster Mode)]
            S3[(S3 Bucket<br/>DICOM + Thumbnails)]
        end

        subgraph Monitoring Subnet
            Prometheus[Prometheus<br/>ECS Task]
            Grafana[Grafana<br/>ECS Task]
            Jaeger[Jaeger / X-Ray]
        end
    end

    Internet --> ALB
    ALB -->|/api/*| ECS_API
    ALB -->|/dicom-web/wado-rs/*| ECS_Orthanc
    ALB -->|/*| ECS_Frontend

    ECS_API --> RDS
    ECS_API --> ElastiCache
    ECS_API --> ECS_Orthanc

    ECS_Orthanc --> S3
    ECS_Orthanc -->|Auth callback| ECS_API

    ECS_Worker --> ElastiCache
    ECS_Worker --> ECS_Orthanc
    ECS_Worker --> S3
    ECS_Worker --> RDS

    ECS_API --> Prometheus
    ECS_API --> Jaeger
    Prometheus --> Grafana
```

### Container Architecture

```mermaid
graph TD
    subgraph "Docker Compose - Internal Bridge Network"
        subgraph "Application Containers"
            NestJS["NestJS API<br/>:3000 → host"]
            NextJS["Next.js Frontend<br/>:3001 → host"]
            Orthanc["Orthanc DICOM Server<br/>:8042 internal only"]
            Worker["BullMQ Worker<br/>no exposed port"]
        end

        subgraph "Data Containers"
            PG["PostgreSQL<br/>:5432 internal"]
            Redis["Redis<br/>:6379 internal"]
            MinIO["MinIO<br/>:9000 internal<br/>:9001 console → host"]
        end

        subgraph "Observability Containers"
            Prometheus["Prometheus<br/>:9090 internal"]
            Grafana["Grafana<br/>:3002 → host"]
            Jaeger["Jaeger<br/>:16686 UI → host<br/>:4318 OTLP internal"]
        end
    end

    subgraph "Named Volumes"
        V1[("postgres_data")]
        V2[("minio_data")]
        V3[("redis_data")]
    end

    NestJS -->|Metadata CRUD| PG
    NestJS -->|Enqueue jobs| Redis
    NestJS -->|STOW-RS stream pipe| Orthanc
    NestJS -->|/metrics| Prometheus
    NestJS -->|OTLP traces| Jaeger

    Orthanc -->|Auth callback<br/>internal network| NestJS
    Orthanc -->|Store/retrieve pixels| MinIO

    Worker -->|Consume jobs| Redis
    Worker -->|Fetch rendered frame| Orthanc
    Worker -->|Store thumbnails| MinIO
    Worker -->|Update thumbnail path| PG

    NextJS -->|API calls| NestJS

    Prometheus --> Grafana

    PG --- V1
    MinIO --- V2
    Redis --- V3
```

**Exposed ports to host:** NestJS API (:3000), Next.js frontend (:3001), MinIO console (:9001), Grafana (:3002), Jaeger UI (:16686). All other ports are internal to the Docker bridge network only. Orthanc is deliberately not exposed to the host - all WADO-RS access in local dev goes through NestJS or a local reverse proxy that replicates the ALB path-based routing.

**Named volumes** (`postgres_data`, `minio_data`, `redis_data`) ensure stateful service data persists across container restarts. Orthanc does not need a named volume because pixel data is stored in MinIO via the S3 plugin.

**The Orthanc → NestJS auth callback** runs entirely on the internal bridge network. Orthanc calls `http://nestjs:3000/internal/orthanc/authorize` - this hostname resolves only within the Docker Compose network and is not reachable from the host.

---

## Appendix

### Technology Comparison Notes

**OHIF vs Cornerstone3D:** OHIF is a full viewer application with its own routing, state management, and UI. Embedding it inside a Next.js app means fighting two application shells. Cornerstone3D gives the rendering pipeline without the application layer, so the UI, state, and routing stay entirely within Next.js. Rejected OHIF to avoid the integration friction.

**Microservices vs modular monolith:** Microservices would mean five Dockerfiles, five CI pipelines, five ECS task definitions, and distributed transaction coordination for cross-module workflows. For a small number of bounded contexts and a single team, the operational overhead kills velocity without delivering scaling benefits. Rejected microservices in favor of a modular monolith with clean module boundaries.

**GCP Cloud Run vs AWS ECS Fargate:** Cloud Run's per-request billing and scale-to-zero is attractive, but Orthanc is a long-running server with in-memory indexes that suffers 5-15 second cold starts. The Orthanc-to-NestJS auth callback also needs sub-millisecond private network latency, which VPC connectors on Cloud Run add friction to. Rejected Cloud Run because the persistent-process model of ECS Fargate is a better fit for Orthanc.

**MongoDB vs PostgreSQL:** DICOM metadata is semi-structured, so document storage seems natural, but the worklist state machine needs transactional guarantees on state transitions and the reporting module needs relational joins across users, studies, and reports. Rejected MongoDB because forcing those relational patterns into its transaction model is operationally painful.

**argon2 vs bcrypt:** argon2id is the OWASP recommendation for its GPU-resistance via memory-hardness, but the `argon2` npm package requires native builds that sometimes fail on Alpine Linux Docker images with older glibc. bcrypt at cost factor 12 is adequate for an application with rate-limited login endpoints and account lockout. Rejected argon2 to avoid deployment friction for a marginal security gain in this context.

**Proxying WADO-RS through NestJS vs direct browser → Orthanc:** Proxying pixel data through NestJS would make the API server a throughput bottleneck for large imaging payloads (CT series can be hundreds of megabytes). Direct browser-to-Orthanc access, with authorization enforced via Orthanc's callback plugin to NestJS, keeps pixel transfer off the API server while preserving audit and access control. Rejected the proxy approach to avoid the throughput bottleneck.

### Resolved Questions

- **Orthanc authorization plugin configuration:** the orthanc-authorization plugin sends a JSON POST to `tokens/validate` with fields `token-key`, `token-value` (the raw `Bearer <jwt>` string), `dicom-uid`, `orthanc-id`, `level`, `method`, and `server-id`. NestJS strips the Bearer prefix, verifies the JWT with RS256, enforces role-based access (Technologists are denied GET on study/series/instance levels), and writes an audit log entry before returning `{ granted: true, validity: 0 }`. a second callback at `user/get-profile` returns label/permission arrays derived from the JWT role claim for Orthanc's internal authorization layer.

- **Cornerstone3D WADO-RS URL configuration:** Cornerstone3D's `wadorsImageLoader` accepts an arbitrary WADO-RS root URL when constructing `imageId` strings in the format `wadors:<wadoRoot>/studies/{uid}/series/{uid}/instances/{uid}/frames/1`. the root is set via the `NEXT_PUBLIC_ORTHANC_WADO_URL` environment variable (defaults to `http://localhost:8042/dicom-web`). no custom loader registration or URL rewrite was needed — the standard `wadors:` scheme prefix handles it natively.

- **Refresh token storage on the client:** tokens are stored in `sessionStorage` via Zustand's `persist` middleware with `createJSONStorage(() => sessionStorage)`. sessionStorage was chosen over localStorage because it scopes tokens to the browser tab and clears on tab close, reducing the window for token theft. httpOnly cookies were rejected to avoid CSRF complexity and to keep the auth flow stateless from the server's perspective — the API never sets cookies, only returns JSON tokens.
