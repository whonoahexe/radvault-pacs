# Challenge Brief

## Overview

This assessment evaluates a senior full-stack engineer's ability to architect, build, and deploy a clinical-grade radiology PACS (Picture Archiving and Communication System) within a constrained timeframe. The challenge is intentionally scoped beyond what is achievable through manual coding alone, requiring fluent use of AI-assisted development tools.

**Your mission:** Build **RadVault**, a modern, web-based PACS serving a mid-sized radiology practice. The system must handle DICOM image ingestion, storage, query/retrieval, diagnostic viewing, and radiology reporting — wrapped in production-grade infrastructure.

## The Two-Phase Process

### Phase 1: Requirements Engineering (2–3 hours)

Before writing any code, you will produce a requirements and design document using AI-assisted tools. This document is itself a deliverable that we evaluate.

**Why we evaluate requirements separately:** In real-world engineering, the ability to scope work, identify risks, and communicate a technical plan is just as important as writing code. We want to see how you decompose an unfamiliar domain, make defensible technology decisions, and leverage AI tools for research and planning.

**What to produce** (use [templates/REQUIREMENTS.md](../templates/REQUIREMENTS.md)):

1. **Technology Stack Selection** — Justify your choices for language(s), framework(s), database(s), and key libraries. Explain trade-offs.
2. **System Architecture** — Mermaid/PlantUML diagram showing services, data flow, and external integrations. Include a written explanation.
3. **Data Model** — ER diagram for the core domain (Patient, Study, Series, Instance, Report, User, AuditLog). Include key fields and relationships.
4. **API Contract** — OpenAPI/Swagger specification (or equivalent) for at least the DICOMweb endpoints and the reporting API.
5. **DICOM Handling Strategy** — How you'll parse, store, index, and retrieve DICOM data. Address pixel data vs. metadata separation.
6. **Security Design** — Authentication flow, authorization matrix, PHI audit logging, encryption at rest and in transit.
7. **Infrastructure Blueprint** — Cloud architecture diagram and IaC module breakdown. Container orchestration strategy.
8. **Testing Strategy** — What you'll test at each layer. How you'll obtain test DICOM data.
9. **Scope & Assumptions** — What you're including vs. excluding, and simplifying assumptions.
10. **Estimated Timeline** — How you plan to allocate your ~10–12 hours of implementation time.

**Submission:**
- Push as a Markdown file to your private GitHub repo
- Notify the evaluation team
- We review within 4 business hours and provide feedback
- You may iterate up to 2 times before receiving Phase 2 approval

### Phase 2: Implementation (8–12 hours)

With approved requirements in hand, build RadVault.

**Deliverables:**

| # | Deliverable | Details |
|---|---|---|
| 1 | Source Code Repository | Monorepo or multi-repo. Clean git history. Conventional commits preferred. |
| 2 | Working Docker Compose | `docker compose up` brings up the full stack. Seed data included. |
| 3 | API Documentation | OpenAPI spec served at `/docs` or `/swagger`. |
| 4 | IaC Configuration | Terraform/Pulumi files. Must plan/validate cleanly (no deployment required). |
| 5 | CI/CD Pipeline | GitHub Actions YAML (or equivalent). Lint, test, build at minimum. |
| 6 | Test Suite | Unit tests for business logic. 2+ integration tests for critical paths. Coverage report. |
| 7 | AI Retrospective | 1–2 page summary of your AI-assisted workflow. |

### Evaluation Session (post-submission)

A 60–90 minute live session where you demo the application, walk through architecture decisions, discuss your AI workflow, and answer questions about scaling and production-readiness.

## What We're Evaluating

| Dimension | Weight | Summary |
|---|---|---|
| Architecture & Design Patterns | 30% | Domain-driven design, event sourcing, DICOM modeling, API contracts, separation of concerns |
| Full-Stack Implementation | 25% | Production-quality code across frontend/backend/data layers; type safety; error handling; testing |
| DevOps & Infrastructure | 20% | Containerization, IaC, CI/CD, observability, security posture |
| AI-Assisted Development | 15% | Effective prompting, agent orchestration, knowing when to intervene, iteration velocity |
| Domain Understanding | 10% | DICOM protocol awareness, clinical workflow comprehension, HIPAA considerations |

See the full rubric in [04-EVALUATION-RUBRIC.md](04-EVALUATION-RUBRIC.md).

## Timeline Summary

```
Day 0          Phase 1: Requirements (2–3 hrs)
               ↓ Submit
               Evaluation team reviews (up to 4 hrs)
               ↓ Feedback / Approval

Day 1–2        Phase 2: Implementation (8–12 hrs)
               ↓ Submit (tag v1.0.0)

Day 3–5        Evaluation session scheduled (60–90 min)
```

## Next Steps

1. Read the [Domain Primer](02-DOMAIN-PRIMER.md) to understand PACS and DICOM
2. Read the [Technical Requirements](03-TECHNICAL-REQUIREMENTS.md) for detailed specs
3. Start Phase 1 using [templates/REQUIREMENTS.md](../templates/REQUIREMENTS.md)
