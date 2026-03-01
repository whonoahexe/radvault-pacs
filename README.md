# RadVault PACS — Senior Full-Stack Engineer Assessment

> **Build a clinical radiology PACS in 1–2 days using AI-assisted development.**

---

## What Is This?

This repository contains everything you need for your technical assessment. You'll design and build **RadVault**, a modern web-based Picture Archiving and Communication System (PACS) for a mid-sized radiology practice. PACS is the backbone of every radiology department — it handles the ingestion, storage, retrieval, and display of medical images (X-rays, CT scans, MRIs) using the DICOM standard.

The challenge is intentionally scoped beyond what's achievable through manual coding alone. **You are expected — and encouraged — to use AI coding assistants, agents, and copilots.** We're evaluating your ability to leverage these tools effectively, not whether you can type fast.

## What We're Evaluating

| Dimension | Weight | What We're Looking For |
|---|---|---|
| **Architecture & Design Patterns** | 30% | Domain-driven design, DICOM data modeling, API contracts, separation of concerns |
| **Full-Stack Implementation** | 25% | Production-quality code, type safety, error handling, testing |
| **DevOps & Infrastructure** | 20% | Containerization, IaC, CI/CD, observability |
| **AI-Assisted Development** | 15% | Effective prompting, knowing when to override AI, iteration velocity |
| **Domain Understanding** | 10% | DICOM protocol, clinical workflows, HIPAA awareness |

Full rubric: [docs/04-EVALUATION-RUBRIC.md](docs/04-EVALUATION-RUBRIC.md)

## How It Works: Two Phases

### Phase 1: Requirements Engineering (2–3 hours)

Use an AI agent to produce a requirements and design document. This is itself a deliverable — it demonstrates your ability to scope, decompose, and communicate.

1. Read the [Challenge Brief](docs/01-CHALLENGE-BRIEF.md) and [Domain Primer](docs/02-DOMAIN-PRIMER.md)
2. Copy [templates/REQUIREMENTS.md](templates/REQUIREMENTS.md) into your repo and fill it out
3. Copy [templates/ARCHITECTURE.md](templates/ARCHITECTURE.md) and add your system design
4. Push to a private GitHub repo and notify the evaluation team
5. We review and provide feedback within 4 business hours
6. Iterate (up to 2 rounds) until we reach alignment

### Phase 2: Implementation (8–12 hours)

With approved requirements in hand, build RadVault.

1. Read the [Technical Requirements](docs/03-TECHNICAL-REQUIREMENTS.md)
2. Build the solution — use AI tools aggressively
3. Track your time in [templates/TIMELOG.md](templates/TIMELOG.md)
4. Document your AI workflow in [templates/AI_RETROSPECTIVE.md](templates/AI_RETROSPECTIVE.md)
5. Tag your final commit as `v1.0.0` and notify us

**Acceptance test:** `docker compose up` from a clean clone brings up the full stack.

## Ground Rules

| Rule | Details |
|---|---|
| **AI Tools** | Any and all AI assistants, agents, copilots. **Document what you used.** |
| **Libraries** | Any open-source libraries. Credit them. No proprietary SDKs beyond trial tiers. |
| **OHIF / Cornerstone.js** | Allowed as viewer foundation. We evaluate integration, not viewer authorship. |
| **Orthanc / DCM4CHEE** | Allowed as DICOM server component. We evaluate how you extend it. |
| **Plagiarism** | Do not clone an existing PACS repo wholesale. AI-generated code is fine. |
| **Cloud Deployment** | IaC must be valid but need not be deployed. `docker compose up` is the acceptance test. |
| **Time Tracking** | Required. Use [TIMELOG.md](templates/TIMELOG.md). We're calibrating difficulty, not policing hours. |

## Deliverables Checklist

| # | Deliverable | Required |
|---|---|---|
| 1 | Source code repository with clean git history | Yes |
| 2 | `docker-compose.yml` that brings up the full stack | Yes |
| 3 | API documentation (OpenAPI at `/docs` or `/swagger`) | Yes |
| 4 | Terraform/Pulumi IaC configuration | Yes |
| 5 | CI/CD pipeline definition (GitHub Actions YAML or equivalent) | Yes |
| 6 | Test suite with coverage report | Yes |
| 7 | `TIMELOG.md` | Yes |
| 8 | `AI_RETROSPECTIVE.md` | Yes |
| 9 | `README.md` with setup instructions and architecture overview | Yes |
| 10 | Seed data (synthetic patients, studies, demo accounts) | Yes |

## Validate Your Submission

Before submitting, run our automated checker against your repo:

```bash
# From this assessment repo
make check REPO=/path/to/your/radvault-submission
```

This verifies required files exist, Docker Compose is valid, no hardcoded secrets, and basic structure.

## After Submission

We'll schedule a 60–90 minute session where you:

1. Demo the running application (ingestion → search → view → report)
2. Walk through architecture decisions and trade-offs
3. Discuss your AI-assisted development process
4. Answer questions about scaling, production-readiness, and extension points
5. Discuss what you'd do differently with more time

## Documentation Map

| Document | Audience | Purpose |
|---|---|---|
| [Challenge Brief](docs/01-CHALLENGE-BRIEF.md) | Candidate | Full challenge description and process |
| [Domain Primer](docs/02-DOMAIN-PRIMER.md) | Candidate | DICOM/PACS crash course |
| [Technical Requirements](docs/03-TECHNICAL-REQUIREMENTS.md) | Candidate | Detailed specs for backend, frontend, DevOps |
| [Evaluation Rubric](docs/04-EVALUATION-RUBRIC.md) | Candidate + Evaluators | Scoring criteria per dimension |
| [Resources](docs/05-RESOURCES.md) | Candidate | Helpful links, libraries, test data |
| [Requirements Template](templates/REQUIREMENTS.md) | Candidate | Phase 1 fill-in template |
| [Architecture Template](templates/ARCHITECTURE.md) | Candidate | Design doc template with Mermaid stubs |
| [AI Retrospective Template](templates/AI_RETROSPECTIVE.md) | Candidate | Post-build reflection template |
| [Time Log Template](templates/TIMELOG.md) | Candidate | Time tracking |

---

**Questions?** Reach out to the evaluation team at any time. Good luck — build something you'd be proud to ship.
