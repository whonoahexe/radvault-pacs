# Evaluation Rubric

Each dimension is scored on a 1–4 scale. The final weighted score determines the overall assessment.

| Score | Label | Meaning |
|---|---|---|
| 4 | Exceptional | Exceeds expectations — production-grade, demonstrates mastery |
| 3 | Strong | Meets all requirements with good engineering quality |
| 2 | Adequate | Core requirements met but with notable gaps or shortcuts |
| 1 | Insufficient | Major gaps, poor quality, or incomplete |

---

## Dimension 1: Architecture & Design Patterns (30%)

| Score | Criteria |
|---|---|
| **4** | Clean domain-driven design. DICOM hierarchy modeled correctly with proper value objects and aggregates. API contracts are complete, versioned, and follow REST conventions. Event-driven patterns where appropriate. Clear separation of concerns across layers. Architecture document demonstrates deep understanding of trade-offs. |
| **3** | Logical architecture with well-defined service boundaries. DICOM data model is correct. API contracts cover all required endpoints. Reasonable separation between layers. Minor inconsistencies or areas lacking justification. |
| **2** | Basic service structure exists but boundaries are unclear. DICOM model has gaps (e.g., missing Study-Series-Instance relationships). API design works but is inconsistent or poorly documented. Some mixing of concerns. |
| **1** | No clear architecture. DICOM data model is incorrect or missing. API design is ad-hoc. No meaningful separation of concerns. |

**Key evidence to look for:**
- Requirements document quality and completeness
- How DICOM Patient → Study → Series → Instance hierarchy is modeled
- API contract completeness (DICOMweb + custom endpoints)
- Service boundary decisions and justifications
- Error handling strategy

---

## Dimension 2: Full-Stack Implementation (25%)

| Score | Criteria |
|---|---|
| **4** | Production-quality code across all layers. Type safety throughout. Comprehensive error handling with user-friendly messages. Clean state management in the frontend. DICOM viewer integration is seamless. Reporting workflow is complete with proper state machine. Test coverage is meaningful (not just lines-covered metrics). |
| **3** | Solid implementation of core features. Good type safety. Error handling covers main paths. Frontend is functional and reasonably polished. Viewer displays images correctly. Reporting works end-to-end. Tests cover critical business logic. |
| **2** | Basic features work but code quality varies. Inconsistent error handling. Frontend is functional but rough. Viewer shows images but lacks refinement. Reporting is incomplete (e.g., no signing workflow). Tests are minimal or superficial. |
| **1** | Core features missing or broken. Minimal error handling. Frontend is non-functional or drastically incomplete. Cannot complete the basic workflow: ingest → search → view → report. |

**Key evidence to look for:**
- Can you complete the full clinical workflow? (ingest → search → view → report)
- Code consistency and conventions
- Frontend UX for key workflows (study browser, viewer, reporting)
- Test quality (do tests verify behavior, not just execute code?)
- Edge case handling

---

## Dimension 3: DevOps & Infrastructure (20%)

| Score | Criteria |
|---|---|
| **4** | `docker compose up` brings up the full stack reliably from a clean clone. Multi-stage Docker builds are optimized. IaC is modular, parameterized, and environment-aware. CI/CD pipeline includes lint, test, build, and security scanning. Observability is built in (structured logging, health checks, metrics). Secrets are managed properly. |
| **3** | Docker Compose works with minor manual steps. Dockerfiles are reasonable. IaC is present and validates cleanly. CI/CD has lint and test stages. Health checks and structured logging present. No hardcoded secrets. |
| **2** | Docker Compose requires significant manual intervention or doesn't include all services. IaC exists but has validation errors or is minimal. CI/CD is a basic template. Logging is unstructured. Some hardcoded configuration. |
| **1** | Docker setup is broken or missing. No IaC. No CI/CD definition. No consideration of operational concerns. |

**Key evidence to look for:**
- Clean `docker compose up` experience (this is the acceptance test)
- Seed data is loaded automatically
- IaC `terraform plan` / `pulumi preview` runs clean
- CI/CD pipeline covers the basics
- No secrets in code or config

---

## Dimension 4: AI-Assisted Development (15%)

| Score | Criteria |
|---|---|
| **4** | AI Retrospective demonstrates a sophisticated, intentional workflow. Candidate used AI tools strategically for different tasks (architecture, boilerplate, debugging, testing). Shows clear judgment about when to accept, modify, or reject AI output. Time allocation shows evidence of velocity gains. Describes specific prompting strategies. |
| **3** | Good use of AI tools across multiple aspects of development. Retrospective shows awareness of AI strengths and weaknesses. Some evidence of adapting strategy based on results. Reasonable time efficiency. |
| **2** | Basic AI tool usage. Retrospective is superficial. Limited evidence of strategic thinking about when and how to use AI. May have over-relied on AI without sufficient review, or under-utilized it. |
| **1** | No meaningful AI usage or documentation. Retrospective is missing or trivial. No evidence of AI-assisted workflow. |

**Key evidence to look for:**
- AI Retrospective depth and honesty
- Time log showing velocity patterns
- Code quality consistency (AI-generated code that's been reviewed vs. not)
- Ability to discuss AI decisions in the evaluation session
- Evidence of prompt engineering and agent orchestration

---

## Dimension 5: Domain Understanding (10%)

| Score | Criteria |
|---|---|
| **4** | DICOM hierarchy is modeled precisely. Clinical workflow maps to real-world radiology practice. Worklist and reporting follow established conventions. HIPAA considerations are thoughtfully addressed. Viewer handles windowing and series navigation correctly. Medical imaging terminology is used correctly. |
| **3** | Core DICOM concepts are correct. Clinical workflow is reasonable. Worklist exists with proper status transitions. Basic HIPAA awareness (audit logging, access control). Viewer works for basic interpretation tasks. |
| **2** | DICOM model has some errors but basics are present. Workflow has gaps (e.g., missing worklist or incomplete reporting). HIPAA mentioned but not implemented. Viewer shows images but clinical usability is limited. |
| **1** | Fundamental misunderstanding of DICOM or clinical workflow. No worklist or reporting. No HIPAA consideration. Viewer cannot render DICOM images. |

**Key evidence to look for:**
- Correct use of DICOM UIDs and hierarchy
- Worklist status machine implementation
- Report structure matches clinical conventions
- Viewer windowing presets make clinical sense
- Access control reflects clinical roles

---

## Scoring Formula

```
Final Score = (Architecture × 0.30)
            + (Implementation × 0.25)
            + (DevOps × 0.20)
            + (AI-Assisted × 0.15)
            + (Domain × 0.10)
```

| Final Score | Recommendation |
|---|---|
| ≥ 3.5 | **Strong Hire** — exceptional across dimensions |
| 3.0–3.4 | **Hire** — solid engineer, minor areas for growth |
| 2.5–2.9 | **Lean Hire** — adequate but concerns in some areas |
| 2.0–2.4 | **Lean No Hire** — significant gaps |
| < 2.0 | **No Hire** — fundamental issues |

---

## Evaluation Session Guide (60–90 minutes)

| Phase | Duration | Focus |
|---|---|---|
| **Demo** | 20 min | Candidate demos the full workflow: ingest → search → view → report |
| **Architecture Walk-through** | 15 min | Walk through key design decisions, trade-offs, what they'd change |
| **AI Workflow Discussion** | 15 min | How did they use AI tools? When did they override? What prompting strategies? |
| **Deep Dives** | 15 min | Pick 2–3 areas to probe based on submission quality |
| **Scaling & Production** | 10 min | What would they change for 10x scale? Multi-site? Cloud migration? |
| **Q&A** | 10 min | Candidate questions, wrap-up |
