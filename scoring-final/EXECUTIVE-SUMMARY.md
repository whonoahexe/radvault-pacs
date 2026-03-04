# Executive Summary — RadVault PACS Evaluation

**Candidate:** Noah
**Date:** 2026-03-04 (re-evaluation after commits ea7cac6, 88956ee)
**Evaluator:** Claude Sonnet 4.6 (automated code review)

---

## Weighted Score

| #         | Dimension                      | Weight   | Score | Weighted |
| --------- | ------------------------------ | -------- | ----- | -------- |
| 1         | Architecture & Design Patterns | 30%      | 4     | 1.20     |
| 2         | Full-Stack Implementation      | 25%      | 4     | 1.00     |
| 3         | DevOps & Infrastructure        | 20%      | 4     | 0.80     |
| 4         | AI-Assisted Development        | 15%      | 3     | 0.45     |
| 5         | Domain Understanding           | 10%      | 4     | 0.40     |
| **Final** |                                | **100%** |       | **3.85** |

*Previous score (2026-03-03): 3.40 (Hire). Score movement: +0.45.*

---

## Recommendation Band

> **STRONG HIRE** — exceptional architecture, precise domain knowledge, production-grade security, and a complete end-to-end implementation; post-submission iteration demonstrates exactly the kind of targeted, self-directed improvement that characterizes a senior engineer.

---

## Submission Validator Output (verbatim)

```
╔══════════════════════════════════════════════════╗
║   RadVault Submission Validator                  ║
╚══════════════════════════════════════════════════╝

Checking: .

▸ Required Files
  ✓ README.md exists
  ✓ docker-compose.yml exists
  ✓ TIMELOG.md exists
  ✓ AI_RETROSPECTIVE.md exists

▸ Docker Compose
  ✓ Docker Compose config is valid
  ✓ Services defined in compose file

▸ Infrastructure as Code
  ✓ Terraform files found (.tf)

▸ CI/CD Pipeline
  ✓ GitHub Actions workflows found

▸ Test Suite
  ✓ Test files found (~13 files)

▸ API Documentation
  ✓ OpenAPI/Swagger spec file found

▸ Secret Scanning
  ⚠ Possible secret in: .env (pattern: PRIVATE.KEY)

▸ Git History
  ✓ Git history present (22 commits)
  ✓ v1.0.0 tag found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passed:  12
  Failed:  0
  Warnings: 1

All checks passed. Ready for review.
```

**Validator note:** The single warning (PRIVATE.KEY in `.env`) is expected — `.env` is the local dev environment file, correctly gitignored, containing the RSA key pair for JWT signing. This is not a security concern.

---

## MUST Requirement Coverage

30 of 32 MUST requirements fully implemented. 2 partially implemented. 0 missing.

The two partial MUSTs are unchanged from the first evaluation:

1. **DICOM conformance validation** — content-type is validated; actual DICOM byte validation is delegated to Orthanc (which rejects invalid files). Architecturally sound delegation, not missing functionality.
2. **Study Browser responsive layout** — functional on desktop; xl-breakpoint only for filter grid. Not a blocking issue for a clinical-internal tool.

---

## SHOULD Requirement Coverage (updated)

27 of 30 SHOULD requirements fully implemented. 3 partially implemented. 0 missing.

**In the first evaluation:** 21 fully, 5 partial, 4 missing.

**Fixed since first evaluation:**
- QIDO wildcard matching (now prefix `startsWith`, not substring `contains`)
- Rich text editing (Tiptap with Bold, Italic, Bullet List, Ordered List)
- Grafana dashboard JSON (pre-built 226-line dashboard, auto-provisioned)
- Structured logging JSON in all environments (not just production)
- Security scanning in CI (`npm audit --audit-level=high`)
- Integration tests (3 HTTP-layer spec files against real PostgreSQL)
- Instance `rows`/`columns` in data model

---

## Score Movement Summary

| Dimension              | First Eval | Re-Eval | Delta | Reason                                                                                 |
| ---------------------- | ---------- | ------- | ----- | -------------------------------------------------------------------------------------- |
| Architecture           | 4          | 4       | —     | Already exceptional; Instance data model gap resolved                                  |
| Full-Stack Impl.       | 3          | 4       | +1    | All 4 stated blockers fixed: integration tests, rich text, QIDO wildcard, Instance fields |
| DevOps & Infra         | 3          | 4       | +1    | All 3 stated blockers fixed: security scan in CI, Grafana dashboard, JSON logging      |
| AI-Assisted Dev        | 3          | 3       | —     | 2 of 3 blockers fixed (verbatim prompts + pattern analysis); chain-of-thought absent   |
| Domain Understanding   | 4          | 4       | —     | Already exceptional; unchanged                                                         |
| **Weighted Total**     | **3.40**   | **3.85**| **+0.45** | Hire → Strong Hire                                                                |

---

## Top Strengths

### 1. Architecture documentation is production-grade

The 58KB requirements document rivals a senior engineer's RFC. Every technology choice is explicitly compared against at least one alternative, with specific, non-generic rejection reasons. The WADO-RS proxying decision (direct browser→Orthanc with auth callback, rather than NestJS proxy) correctly identifies a throughput bottleneck and solves it with a production-appropriate pattern most candidates would miss entirely.

### 2. DICOM domain accuracy is precise and verified

All DICOM tag codes are referenced correctly by hex (0020000D, 0020000E, 00080018, etc.). Window/level presets are clinically standard (Lung -1350/150, Bone -600/1400, Soft Tissue -160/240, Brain 0/80). Worklist state machine (Scheduled → InProgress → Preliminary → Final → Amended) matches real radiology workflow. Referring Physician scoping is implemented at the query layer, not just the display layer. QIDO wildcard matching now correctly uses prefix semantics (`DOE*` → `LIKE 'DOE%'`).

### 3. Full workflow is end-to-end verifiable from code and integration tests

The complete clinical workflow (upload DICOM → QIDO search → Cornerstone3D viewer → claim worklist → create/sign report → worklist auto-transitions) is wired together with transactional correctness. Three HTTP-layer integration test files (auth, DICOM+worklist, report lifecycle+RBAC) now run against a real PostgreSQL instance in CI, verifying the workflow behaves correctly — not just that the code compiles.

### 4. Security architecture is defense-in-depth

RS256 JWT (not HS256), refresh token rotation with token family reuse detection (revokes entire family on stolen token use), bcrypt at cost 12, PHI audit logging on every access (including WADO-RS via Orthanc callback), append-only audit log verified in code, ReferringPhysician patient scoping enforced at query level, SSM Parameter Store for secrets in IaC, `npm audit --audit-level=high` in CI pipeline.

### 5. Structured AI workflow with honest, concrete retrospective

Context7 MCP for live API documentation before each library integration is a specific, non-obvious strategy that directly reduced implementation churn. The retrospective now includes verbatim prompt examples showing the "constrained + acceptance criteria" approach, plus explicit root-cause analysis of AI failures (the auth callback prompt lacked deny-by-default wording → permissive output → corrected with explicit constraint). The two-phase workflow (architecture sign-off before coding) is demonstrably practiced.

### 6. Targeted post-submission iteration demonstrates senior-engineer judgment

The two post-submission commits addressed exactly the right gaps — no over-engineering, no added scope. Each fix was targeted: QIDO wildcard (semantic correctness), Tiptap (clinical usability), integration tests (verification depth), Grafana dashboard (observability), JSON logging (operational consistency), `npm audit` (supply chain security), `.dockerignore` (build hygiene). This demonstrates the ability to correctly prioritize quality debt.

---

## Remaining Concerns

### 1. Test coverage depth (no E2E / browser tests)

Integration tests now exist and run against a real PostgreSQL instance in CI. However, there are no Playwright or Cypress E2E tests. A radiologist clicking through the viewer to the reporting interface is not tested end-to-end in a browser context. For a production healthcare application, browser-level test coverage of the WADO-RS viewer and report signing flow would be expected. This is the last major testing gap.

### 2. AI-Assisted Development dimension not fully at 4

The retrospective is significantly better with verbatim prompt examples, but chain-of-thought, few-shot, and agent orchestration techniques are not discussed. The retrospective shows prompt iteration (initial → corrected) but does not describe the reasoning structure of the prompt chain. For a 4 in this dimension, the candidate would need to articulate how complex multi-turn AI interactions were managed.

### 3. No multi-viewport in the viewer (MAY requirement)

The viewer remains single-viewport. Most radiologists reading complex CT studies expect at least a 1×2 or 2×2 grid. This is a MAY requirement and does not affect the score, but it would limit clinical adoption for high-volume reading environments.

### 4. No registry push or deploy step in CI

The `docker-build` job builds all three images but does not push to a registry or deploy. There is no CD. For a production system, even a basic `docker push` step to ECR would be expected in the pipeline.

---

## One-Line Summary

A fully-deployed, architecturally exceptional PACS implementation with precise DICOM domain accuracy, production-grade security, and a complete end-to-end workflow — elevated from Hire to Strong Hire by targeted post-submission fixes that addressed every major gap identified in the first evaluation.

---

## Suggested Evaluation Session Focus Areas

Given the re-evaluation scores, the live session should probe the remaining areas of uncertainty:

1. **Architecture depth**: Ask to explain the Orthanc authorization callback design — specifically why the auth check happens server-to-server vs. in NestJS middleware. Look for understanding of the throughput vs. security trade-off and why this avoids the N+1 proxy problem.

2. **AI workflow**: The retrospective shows excellent prompt examples but not multi-turn reasoning. Ask: "For the report service, how did you manage context across multiple AI prompts? Did you ever hit context limit issues and how did you handle them?" Look for evidence of deliberate context management, not just single-shot prompting.

3. **Test strategy**: The integration tests are good, but no E2E. Ask: "If you had 4 more hours, what would you test first and why?" — look for whether the candidate would reach for browser-level tests (Playwright) or more integration coverage first, and the reasoning.

4. **Scaling question**: "If this system needed to support 1,000 concurrent radiologists across 50 hospitals, what would you change first?" — look for answers about WADO-RS CDN caching (the Orthanc-direct approach has a scaling ceiling), read replicas, worklist pagination at scale, and Orthanc clustering. The architecture document mentions some of this — probe whether it's understood or just documented.

5. **QIDO pagination**: The implementation uses `page` instead of `offset` (the DICOMweb spec uses `offset` and `limit`). Ask if the candidate is aware of the semantic difference and what production impact it might have (cursor-based vs. offset pagination for high-volume query scenarios).
