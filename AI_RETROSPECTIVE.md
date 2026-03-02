# AI Retrospective

> Reflect on how you used AI-assisted development tools throughout this assessment. Honesty is valued over polish — we want to understand your actual workflow.

**Author:** Noah
**Date:** 2026-03-03

---

## Tools Used

| Tool | Version | How You Used It |
|---|---|---|
| Claude (Sonnet 4.5 via GitHub Copilot) | Sonnet 4.5 | Primary coding assistant for implementation, refactors, and test generation in iterative prompt loops |
| Context7 MCP | Latest docs resolution at usage time | Proactively resolved current library APIs before each integration to avoid stale examples and API drift |

---

## Workflow Strategy

I used a two-phase workflow. Phase 1 focused on requirements and architecture alignment before coding. Phase 2 followed an 8-step implementation plan (scaffold, backend core, frontend, worker, seed data, IaC/CI, tests, docs). AI generated most code and tests, but each step had a human review gate before proceeding to the next step.

Prompting strategy was task-specific and constrained: define the exact module/feature boundary, provide acceptance criteria from the requirements document, request complete file sets for that boundary, then verify behavior with tests or E2E scripts before continuing.

---

## What Worked Well

AI accelerated delivery significantly when the requirements were explicit and the domain boundary was clear.

### Example 1

NestJS module scaffolding: with a bounded-context prompt per module, AI generated complete module structure in one pass (service/controller/dto/guard/decorator). This removed repetitive boilerplate and let effort focus on business logic and verification.

### Example 2

Prisma schema + workflow/state logic: AI produced the full 10-model schema correctly on the first try and implemented state machine logic for worklist transitions and report lifecycle with an `allowedTransitions` map, including separation between controller workflow and report workflow.

Cornerstone3D integration also worked well because Context7 was used first to resolve current loader APIs, which prevented implementation against deprecated cornerstoneWADOImageLoader patterns.

Test generation was high leverage: AI generated 41 unit tests that covered state-machine paths and authentication edge cases.

---

## What Didn't Work

AI output was occasionally overly permissive or incomplete in security-sensitive paths and integration edge cases.

### Example 1

Orthanc authorization callback: initial AI stub returned `granted: true` unconditionally. This required manual correction to enforce role-based decisions and the Technologist GET restriction.

### Example 2

RBAC coverage gap: two endpoints (worklist access for ReferringPhysician and reports access for Technologist) were missing `@Roles` guards. This was caught by E2E validation, not by initial generated code.

Operational sequencing also needed manual correction: seed timing initially ran before NestJS readiness (causing Orthanc STOW-RS 403 responses), and worker frame fetches initially failed with Orthanc 403 until `WORKER_JWT` auto-generation was added.

---

## Manual Interventions

- Replaced unconditional Orthanc auth callback with role-aware authorization logic and Technologist GET restriction.
- Added missing `@Roles` guards on two endpoints identified by E2E script failures.
- Added health-check retry loop to seed flow so DICOM ingest waits for API readiness.
- Added worker startup `WORKER_JWT` auto-generation to resolve rendered-frame authorization failures.

Pattern observed: AI was strongest on structure/boilerplate and deterministic transforms, but weaker on cross-service authorization nuance and startup sequencing assumptions.

---

## Velocity Analysis

AI most accelerated scaffolding, schema authoring, and unit test generation. It was less reliable in security and environment orchestration edge cases, where manual verification and targeted fixes were required.

Step-boundary reviews reduced rework: each phase was validated before moving forward, which prevented architectural drift and made issue localization faster.

| Category | Estimated % of Final Code |
|---|---|
| AI-generated, used as-is | ~45% |
| AI-generated, human-edited | ~40% |
| Human-written from scratch | ~15% |

---

## Lessons Learned

- Always treat auth/RBAC outputs as draft code and force explicit deny-by-default prompts.
- Add E2E authorization checks earlier to catch missing guards before feature completion.
- Keep Context7-first integration policy for third-party libraries; it materially reduced API mismatch churn.
- Include startup/readiness acceptance criteria in prompts for any multi-container workflow.

---

## Recommendations

- Use a two-phase process: requirements/architecture sign-off first, implementation second.
- Enforce step-boundary human reviews tied to requirements checkpoints.
- Standardize Context7 documentation resolution before every new library integration.
- Maintain CI-safe unit tests plus realistic E2E scripts to validate permissions and runtime sequencing.
