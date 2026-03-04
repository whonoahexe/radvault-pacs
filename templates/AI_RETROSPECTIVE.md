# AI Retrospective

> Reflect on how you used AI-assisted development tools throughout this assessment. Honesty is valued over polish - we want to understand your actual workflow.

**Author:** Noah
**Date:** 2026-03-03

---

## Tools Used

| Tool                           | Version                              | How You Used It                                                                                                                                                |
| ------------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Desktop (Sonnet 4.6)    | Sonnet 4.6                           | Repo connected as a project for persistent context; used to generate scoped planning prompts and cross-check implementation plans from Antigravity             |
| Antigravity IDE                | Latest                               | Received planning prompts from Claude Desktop and produced detailed, step-by-step implementation plans that were iterated on before handing off to code agents |
| Codex 5.3 (via GitHub Copilot) | 5.3                                  | Primary code generation agent; fed finalized implementation plans and produced file-level output for most tasks                                                |
| Claude Code (Opus 4.6)         | Opus 4.6                             | Handled larger, chunkier tasks where a single Codex pass wasn't enough; better at holding multi-file context across a long generation                          |
| Context7 MCP                   | Latest docs resolution at usage time | Attached to all agents; resolved current library APIs before each integration to avoid stale examples and API drift                                            |

---

## Workflow Strategy

I used a two-phase workflow. Phase 1 focused on requirements and architecture alignment before coding. Phase 2 followed an 8-step implementation plan (scaffold, backend core, frontend, worker, seed data, IaC/CI, tests, docs).

The actual tool chain per task worked like this: the repo was connected to Claude Desktop (Sonnet 4.6) as a project so it always had full codebase context. I'd ask it to produce a scoped planning prompt for the next task. That prompt went into Antigravity IDE, which returned a detailed implementation plan. I'd paste the plan back into Claude Desktop to cross-check it against the architecture and requirements, run a couple of iteration rounds, then feed the final plan to Codex 5.3 via GitHub Copilot for code generation. If the task was large enough that Codex started losing coherence across files, I handed it off to Opus 4.6 in Claude Code instead. All agents had Context7 MCP available so library docs were resolved at usage time rather than baked into the prompt.

After generation I reviewed the diff manually, made tweaks, pushed, and ran the E2E or integration tests before starting the next task the same way.

---

## What Worked Well

AI accelerated delivery significantly when the requirements were explicit and the domain boundary was clear.

### Example 1

NestJS module scaffolding: with a bounded-context prompt per module, AI generated complete module structure in one pass (service/controller/dto/guard/decorator). This removed repetitive boilerplate and let effort focus on business logic and verification.

**Actual prompt used (WorklistModule):**

> You are implementing a NestJS module for DICOM worklist management in a radiology PACS system. The module is called WorklistModule and lives at `apps/api/src/modules/worklist/`. It needs:
>
> - A WorklistService with `getWorklist(query)`, `getWorklistItem(id)`, `transition(id, newStatus, userId, options)`, and `assign(id, assignTo, userId)` methods
> - A state machine using an `allowedTransitions` map: Scheduled→InProgress, InProgress→Scheduled|Preliminary, Preliminary→Final, Final→Amended. Transitions not in the map must throw a BadRequestException.
> - WorklistController with JWT guard and @Roles decorators: Radiologist can claim/unclaim (Scheduled↔InProgress), Admin can assign, ReferringPhysician read-only
> - DTOs with class-validator: WorklistQueryDto (status, priority, assignedTo, page, limit), AssignWorklistDto (assignTo: UUID), TransitionWorklistDto (status: WorklistStatus enum)
> - Status changes must call AuditService.log with WORKLIST_CLAIM, WORKLIST_UNCLAIM, or WORKLIST_ASSIGN actions
> - source: 'controller' | 'report' option so the report workflow can drive Preliminary→Final without going through the controller guard
> - No direct imports from other feature modules - only inject shared PrismaService, AuditService
>
> Return all files for this module as complete TypeScript.

**What was produced:** Full module scaffold - service, controller, 3 DTOs, module definition - in one pass. Used with two edits: added the `source: 'controller' | 'report'` field to `TransitionOptions` and added Prisma `TransactionClient` injection for the report workflow cross-module call.

### Example 2

Prisma schema + workflow/state logic: AI produced the full 10-model schema correctly on the first try and implemented state machine logic for worklist transitions and report lifecycle with an `allowedTransitions` map, including separation between controller workflow and report workflow.

Cornerstone3D integration also worked well because Context7 was used first to resolve current loader APIs, which prevented implementation against deprecated cornerstoneWADOImageLoader patterns.

**Actual prompt used (Cornerstone3D viewer hook):**

> Using the Context7-resolved Cornerstone3D docs for `@cornerstonejs/core` and `@cornerstonejs/dicom-image-loader` (v2.x), implement a React hook `useCornerstoneViewer(containerRef, wadoRsRoot, studyInstanceUid)` for the RadVault web viewer. Requirements:
>
> 1. Initialize Cornerstone3D with a WebGL2 RenderingEngine (id: 'radvault-engine')
> 2. Register the WADO-RS image loader using `@cornerstonejs/dicom-image-loader`. Attach an `imageLoadImageRetrieveManager` that injects `Authorization: Bearer <token>` using the access token from the Zustand auth store (`useAuthStore.getState().accessToken`)
> 3. Create a STACK viewport bound to the containerRef element
> 4. Derive imageIds from the WADO-RS root using the pattern: `wadors:<wadoRsRoot>/studies/<studyInstanceUid>/series/<seriesInstanceUid>/instances/<sopInstanceUid>/frames/1`
> 5. Load the stack into the viewport and set the initial W/L to default
> 6. Return `{ toolGroup, viewport, isLoading, error }`
> 7. Clean up the rendering engine on unmount
>    Do NOT use deprecated `cornerstoneWADOImageLoader` patterns - use `@cornerstonejs/dicom-image-loader` exclusively.

**What was produced:** Hook implementation with correct v2.x APIs. Used as-is after adding explicit TypeScript type annotations for `viewport as Types.IStackViewport` to satisfy the tsconfig `strict` setting.

Test generation was high leverage: AI generated 41 unit tests that covered state-machine paths and authentication edge cases.

---

## What Didn't Work

AI output was occasionally overly permissive or incomplete in security-sensitive paths and integration edge cases.

### Example 1

Orthanc authorization callback: initial AI stub returned `granted: true` unconditionally. This required manual correction to enforce role-based decisions and the Technologist GET restriction.

**Initial prompt (caused the problem):**

> Implement the Orthanc authorization callback endpoint `POST /api/internal/orthanc-auth` in NestJS. Orthanc calls this endpoint before every WADO-RS request. Return JSON with `granted: true` if the request should be allowed.

**What was produced:** A controller handler that returned `{ granted: true }` for every request with no JWT validation, no role check, and no handling of missing tokens.

**What the prompt was missing:** No explicit deny-by-default requirement, no instruction to extract and verify the Bearer token from the Orthanc request body, and no role-based access specification. The prompt described the callback mechanism but not the authorization logic. Because the acceptance criteria were vague on _how_ to decide `granted`, the model defaulted to permissive.

**Fix prompt (explicit constraint added):**

> Revise `POST /api/internal/orthanc-auth`. Requirements:
>
> 1. Extract the Bearer JWT from the `token` field in the Orthanc authorization request body
> 2. Deny by default - return `{ granted: false }` for any request with an unverifiable, expired, or missing token
> 3. Radiologist and Admin roles: grant both READ (GET/HEAD) and WRITE (POST/PUT/DELETE) access
> 4. Technologist role: grant READ (GET/HEAD) only; deny WRITE
> 5. ReferringPhysician role: deny all WADO-RS access (they access studies through the NestJS API layer, not direct Orthanc)
> 6. Never throw HTTP exceptions from this handler - catch all errors and return `{ granted: false }` to prevent Orthanc from treating a 500 as a grant
> 7. The handler must live in InternalModule which is excluded from the global JwtAuthGuard

**Result after fix:** Role-aware handler with explicit deny-by-default, Technologist HTTP method restriction, and a catch-all error wrapper - matching the authorization model described in the architecture document.

### Example 2

RBAC coverage gap: two endpoints (worklist access for ReferringPhysician and reports access for Technologist) were missing `@Roles` guards. This was caught by E2E validation, not by initial generated code.

Operational sequencing also needed manual correction: seed timing initially ran before NestJS readiness (causing Orthanc STOW-RS 403 responses), and worker frame fetches initially failed with Orthanc 403 until `WORKER_JWT` auto-generation was added.

### Example 3

Prisma 7 migration pain: upgrading to Prisma 7 caused CI to blow up repeatedly during integration tests. The root issue was that Prisma 7 changed how the query engine binary is resolved in containerized environments - the old `binaryTargets` config that worked fine in Prisma 5/6 no longer produced a compatible binary for the test runner container. This wasn't obvious from the error output, which just showed generic connection-refused or "engine not found" panics rather than anything pointing at the binary.

Fix required pinning the correct `binaryTargets` for the CI container OS, moving the Prisma generate step earlier in the Dockerfile so it ran at build time rather than entrypoint time, and adding a smoke-test assertion to confirm the engine was present before any integration test suite started. Took longer than expected because all three agents initially suggested fixes that were correct for Prisma 5 but no longer applied in v7.

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

| Category                   | Estimated % of Final Code |
| -------------------------- | ------------------------- |
| AI-generated, used as-is   | ~45%                      |
| AI-generated, human-edited | ~40%                      |
| Human-written from scratch | ~15%                      |

---

## Lessons Learned

- Auth and RBAC code needs to be treated as a first review target every time. The models are not naturally conservative - they default to permissive unless the prompt explicitly says otherwise. "Deny by default" needs to be in the words of the prompt, not assumed.
- Don't wait until the end to run authorization E2E checks. Missing guards on two endpoints slipped through because the unit tests didn't exercise the guard layer end-to-end. Running the permission matrix earlier would have caught it before the feature was considered done.
- Lock down your ORM version before you start and stay on it. Prisma 7 introduced breaking binary resolution changes in containerized builds that cost real time to debug. When the error output doesn't point at the actual cause, you lose a lot of time chasing symptoms. If there's no specific reason to be on the latest major, don't be.
- Context7 MCP resolving docs at usage time is worth the extra setup. Every time a library integration worked cleanly on the first pass, Context7 was in the loop. The one time Cornerstone3D was started without resolving current docs first, the generated code used deprecated loader patterns that had to be rewritten.
- Multi-agent orchestration only helps if the handoff is clean. Passing a vague plan from Claude Desktop to Codex produced mediocre output. Passing a tightly scoped plan with explicit file boundaries and acceptance criteria produced something reviewable. The quality of the planning prompt mattered more than which code agent received it.

---

## Recommendations

- Use a two-phase process: requirements/architecture sign-off first, implementation second.
- Enforce step-boundary human reviews tied to requirements checkpoints.
- Standardize Context7 documentation resolution before every new library integration.
- Maintain CI-safe unit tests plus realistic E2E scripts to validate permissions and runtime sequencing.
