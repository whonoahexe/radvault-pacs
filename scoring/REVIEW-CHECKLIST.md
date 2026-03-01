# Submission Review Checklist

> **For:** Evaluation team. Run through this checklist before the evaluation session. Items marked ⚡ can be automated with `make check`.

**Candidate:** ___________________________
**Repo URL:** ___________________________
**Date:** ___________________________

---

## Phase 1: Requirements Document

- [ ] Requirements document exists and covers all 10 sections
- [ ] Technology choices are justified with trade-offs
- [ ] Architecture diagram is present and coherent
- [ ] Data model covers the DICOM hierarchy (Patient → Study → Series → Instance)
- [ ] API contract covers DICOMweb endpoints (STOW, QIDO, WADO)
- [ ] Security design includes RBAC and audit logging
- [ ] Infrastructure blueprint is present
- [ ] Scope and assumptions are explicitly stated
- [ ] Timeline estimate is realistic

**Phase 1 verdict:** Pass / Needs Revision / Fail

---

## Phase 2: Repository Structure

- [ ] ⚡ `README.md` exists with setup instructions
- [ ] ⚡ `docker-compose.yml` exists and is valid YAML
- [ ] ⚡ `TIMELOG.md` exists and is filled in
- [ ] ⚡ `AI_RETROSPECTIVE.md` exists and is filled in
- [ ] ⚡ IaC files exist (`.tf` or Pulumi files)
- [ ] ⚡ CI/CD pipeline definition exists (`.github/workflows/` or equivalent)
- [ ] ⚡ Test files exist
- [ ] ⚡ No hardcoded secrets (passwords, API keys, tokens) in source
- [ ] Clean git history with meaningful commit messages

---

## Phase 2: Docker Compose

- [ ] `docker compose up` succeeds from a clean clone
- [ ] All services start and reach healthy state
- [ ] Seed data is loaded automatically
- [ ] Application is accessible in the browser
- [ ] No manual steps required beyond `docker compose up`

**If Docker fails:** Note the error and move on. Evaluate code quality separately.

---

## Phase 2: Functional Verification

### DICOM Ingestion
- [ ] Can upload a DICOM file via the API or UI
- [ ] Study appears in the study browser after upload
- [ ] Metadata is correctly parsed and displayed

### Study Browser
- [ ] Study list loads with patient info, modality, date
- [ ] Search/filter works (at least one filter)
- [ ] Can click through to open a study

### Diagnostic Viewer
- [ ] DICOM images display correctly
- [ ] Can scroll through a multi-slice series
- [ ] Window/level adjustment works
- [ ] Pan/zoom works

### Reporting
- [ ] Can create a report linked to a study
- [ ] Can save a draft report
- [ ] Can sign/finalize a report
- [ ] Report status reflects in the worklist

### Authentication
- [ ] Can log in with demo credentials
- [ ] Protected routes require authentication
- [ ] Different roles see different capabilities

---

## Phase 2: Code Quality (Spot Check)

- [ ] Consistent code style and conventions
- [ ] Type safety (TypeScript types, Python type hints, etc.)
- [ ] Error handling in API endpoints
- [ ] Tests verify behavior (not just line coverage)
- [ ] API documentation accessible at `/docs` or `/swagger`

---

## Phase 2: Infrastructure

- [ ] IaC validates cleanly (`terraform validate` or equivalent)
- [ ] CI/CD pipeline has lint + test stages
- [ ] Health check endpoints work (`/health`)
- [ ] No credentials in Docker Compose or IaC files

---

## Summary

| Area | Status | Notes |
|---|---|---|
| Phase 1: Requirements | ✅ / ⚠️ / ❌ | |
| Repo Structure | ✅ / ⚠️ / ❌ | |
| Docker Compose | ✅ / ⚠️ / ❌ | |
| DICOM Ingestion | ✅ / ⚠️ / ❌ | |
| Study Browser | ✅ / ⚠️ / ❌ | |
| Diagnostic Viewer | ✅ / ⚠️ / ❌ | |
| Reporting | ✅ / ⚠️ / ❌ | |
| Authentication | ✅ / ⚠️ / ❌ | |
| Code Quality | ✅ / ⚠️ / ❌ | |
| Infrastructure | ✅ / ⚠️ / ❌ | |

**Ready for evaluation session?** Yes / No — needs: ___________________________
