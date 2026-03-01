# RadVault — Architecture Document

> Companion to [REQUIREMENTS.md](REQUIREMENTS.md). This document captures your system design with diagrams and detailed explanations.

**Author:** <!-- Your name -->
**Date:** <!-- Date -->

---

## System Overview

### High-Level Architecture

```mermaid
graph TD
    %% REPLACE with your actual architecture
    subgraph Client
        Browser[Web Browser]
    end

    subgraph "API Layer"
        GW[API Gateway / Reverse Proxy]
    end

    subgraph "Application Services"
        Auth[Auth Service]
        DICOM[DICOM Service]
        Worklist[Worklist Service]
        Report[Reporting Service]
    end

    subgraph "Data Layer"
        DB[(PostgreSQL)]
        ObjStore[(Object Storage / MinIO)]
        Cache[(Redis)]
    end

    Browser --> GW
    GW --> Auth
    GW --> DICOM
    GW --> Worklist
    GW --> Report

    Auth --> DB
    Auth --> Cache
    DICOM --> DB
    DICOM --> ObjStore
    Worklist --> DB
    Report --> DB
```

### Description

<!-- Explain your architecture decisions:
     - Why this service structure? (monolith, modular monolith, microservices)
     - How do services communicate?
     - What are the key data flows?
     - Where are the scaling bottlenecks?
-->

---

## Data Model

### Entity-Relationship Diagram

```mermaid
erDiagram
    PATIENT {
        uuid id PK
        string patient_id UK
        string name
        date date_of_birth
        string sex
    }

    STUDY {
        uuid id PK
        string study_instance_uid UK
        date study_date
        string study_description
        string modality
        string accession_number
        string referring_physician
        uuid patient_id FK
    }

    SERIES {
        uuid id PK
        string series_instance_uid UK
        int series_number
        string series_description
        string modality
        uuid study_id FK
    }

    INSTANCE {
        uuid id PK
        string sop_instance_uid UK
        int instance_number
        int rows
        int columns
        string storage_path
        uuid series_id FK
    }

    REPORT {
        uuid id PK
        text content
        string status
        uuid study_id FK
        uuid signed_by FK
        timestamp signed_at
    }

    USER {
        uuid id PK
        string username UK
        string email UK
        string password_hash
        string role
        boolean is_active
    }

    WORKLIST_ITEM {
        uuid id PK
        string status
        string priority
        uuid study_id FK
        uuid assigned_to FK
        timestamp claimed_at
    }

    AUDIT_LOG {
        uuid id PK
        uuid user_id FK
        string action
        string resource_type
        string resource_id
        timestamp timestamp
        string ip_address
    }

    PATIENT ||--o{ STUDY : "has"
    STUDY ||--o{ SERIES : "contains"
    SERIES ||--o{ INSTANCE : "contains"
    STUDY ||--o| REPORT : "has"
    STUDY ||--o| WORKLIST_ITEM : "tracked by"
    USER ||--o{ REPORT : "authors"
    USER ||--o{ WORKLIST_ITEM : "assigned"
    USER ||--o{ AUDIT_LOG : "generates"
```

<!-- MODIFY the diagram above to match your actual data model.
     Add fields, relationships, and entities as needed. -->

### Design Decisions

<!-- Explain:
     - Why these field types?
     - How do DICOM UIDs map to your IDs?
     - How do you handle DICOM metadata beyond the core fields?
     - Indexing strategy for query performance
-->

---

## Request Flow Diagrams

### DICOM Ingestion Flow

```mermaid
sequenceDiagram
    %% REPLACE with your actual flow
    participant M as Modality / Upload Client
    participant API as API Gateway
    participant DS as DICOM Service
    participant DB as Database
    participant S3 as Object Storage

    M->>API: POST /studies (multipart/related)
    API->>DS: Forward DICOM payload
    DS->>DS: Parse DICOM headers
    DS->>DB: Upsert Patient, Study, Series, Instance
    DS->>S3: Store pixel data
    DS->>DB: Create WorklistItem (Scheduled)
    DS-->>API: 200 OK + storage confirmation
    API-->>M: Response
```

### Study Viewing Flow

```mermaid
sequenceDiagram
    %% REPLACE with your actual flow
    participant R as Radiologist Browser
    participant API as API Gateway
    participant WS as Worklist Service
    participant DS as DICOM Service
    participant DB as Database
    participant S3 as Object Storage

    R->>API: GET /worklist?status=Scheduled
    API->>WS: Query worklist
    WS->>DB: Fetch scheduled items
    WS-->>R: Worklist with study metadata

    R->>API: PATCH /worklist/{id} (claim)
    API->>WS: Update status to InProgress

    R->>API: GET /studies/{uid}/series
    API->>DS: Query series
    DS->>DB: Fetch series metadata
    DS-->>R: Series list

    R->>API: GET .../instances/{uid}/rendered
    API->>DS: Retrieve rendered frame
    DS->>S3: Fetch pixel data
    DS->>DS: Apply windowing, render to JPEG
    DS-->>R: Rendered image
```

### Reporting Flow

```mermaid
sequenceDiagram
    %% REPLACE with your actual flow
    participant R as Radiologist Browser
    participant API as API Gateway
    participant RS as Report Service
    participant WS as Worklist Service
    participant DB as Database

    R->>API: POST /reports (draft)
    API->>RS: Create report
    RS->>DB: Save draft report

    R->>API: PUT /reports/{id} (update)
    API->>RS: Update content
    RS->>DB: Save updated draft

    R->>API: POST /reports/{id}/sign
    API->>RS: Finalize report
    RS->>DB: Update report status to Final
    RS->>WS: Update worklist status to Final
    RS-->>R: Signed report confirmation
```

---

## Security Architecture

### Authentication Flow

```mermaid
sequenceDiagram
    %% REPLACE with your actual auth flow
    participant U as User
    participant API as API Gateway
    participant Auth as Auth Service
    participant DB as Database

    U->>API: POST /auth/login (credentials)
    API->>Auth: Validate credentials
    Auth->>DB: Verify password hash
    Auth-->>U: JWT access token + refresh token

    U->>API: GET /studies (with Bearer token)
    API->>Auth: Validate JWT
    Auth-->>API: User context (role, permissions)
    API->>API: Authorize based on role
```

### Authorization Matrix

<!-- Fill in your actual permission model -->

---

## Infrastructure

### Cloud Deployment Architecture

```mermaid
graph TD
    %% REPLACE with your actual cloud architecture
    subgraph "Public"
        CDN[CDN / CloudFront]
        LB[Application Load Balancer]
    end

    subgraph "Private Subnet"
        App1[App Instance 1]
        App2[App Instance 2]
    end

    subgraph "Data Subnet"
        RDS[(RDS PostgreSQL)]
        S3[(S3 Bucket)]
        ElastiCache[(ElastiCache Redis)]
    end

    CDN --> LB
    LB --> App1
    LB --> App2
    App1 --> RDS
    App2 --> RDS
    App1 --> S3
    App2 --> S3
    App1 --> ElastiCache
    App2 --> ElastiCache
```

### Container Architecture

```mermaid
graph TD
    subgraph "Docker Compose"
        Nginx[Nginx Reverse Proxy]
        App[Application Container]
        DB[(PostgreSQL)]
        MinIO[(MinIO - S3 Compatible)]
        Redis[(Redis)]
    end

    Nginx -->|:80/:443| App
    App --> DB
    App --> MinIO
    App --> Redis
```

---

## Appendix

### Technology Comparison Notes

<!-- If you evaluated multiple options, document your comparison here -->

### Open Questions

<!-- List any unresolved questions for discussion with the evaluation team -->
