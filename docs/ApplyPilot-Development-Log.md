# ApplyPilot development log

## Stage 1 — Frontend
Date: 11 October 2026
Status: Stage 1 complete. Functional checks, TypeScript checks, 13 regression checks and production build passed.

### Implemented
- Applications list with search, status shortcuts/filter and date sorting.
- Create/edit forms with required-field validation; delete confirmation.
- Application details, notes, status updates and event timeline.
- Demo email analysis, editable review, source-email attachment, duplicate detection.
- Overview counts, upcoming interviews, follow-up dates and recent activity.
- Responsive desktop sidebar and mobile navigation/cards.

### Verification performed
- Browser: empty create form rejected; temporary application added and detail opened.
- Browser: sample confirmation analysed, reviewed and saved; saved record edited successfully.
- Browser: search narrowed to one record; interview filter showed one matching record; oldest-first sort displayed correct order.
- Browser: temporary imported record deleted; count returned from seven to six.
- Browser: overview displayed six records, upcoming interview and follow-up dates.
- Browser: desktop table and narrow mobile overview inspected; no document-wide horizontal overflow on mobile (navigation scrolls horizontally).
- TypeScript full-project check passed.
- 13 executable service regression checks passed: CRUD, trimming, timeline, date handling, import, duplicate guard, correction persistence, role-aware matching and cleanup.
- Production build verified in user PowerShell on 11 October 2026 at 23:42. Client, SSR and Nitro builds passed; final script message confirmed all checks passed. Non-blocking plugin/configuration warnings remain. Build currently targets Cloudflare; deployment configuration and deployed runtime verification belong to the deployment stage.

### Bug register
| ID | Problem/evidence | Fix | Verification |
|---|---|---|---|
| AP-01 | Garbled punctuation in application title and list | Corrected UTF-8 text | Browser title/list verified |
| AP-02 | UTC-based today could select the previous date around local midnight | Use local calendar date | Regression/date checks |
| AP-03 | Date-time strings produced invalid days-until calculations | Normalize to calendar-date portion | Regression |
| AP-04 | Duplicate email guard only ran at analysis time | Repeat check immediately before import save | Repeated-save regression |
| AP-05 | Review corrections to company/role ignored on update | Persist reviewed fields and list them in proposed changes | Regression |
| AP-06 | Company-only match could select a different role | Match both company and role | Regression |
| AP-07 | Clear retained validation errors; editing retained stale duplicate message | Clear errors/status when resetting/editing | Code inspection |
| AP-08 | Email/sample inputs remained editable while analysis was pending | Disable them during analysis | Browser disabled-state verified |
| AP-09 | Overview lacked error/retry branch | Add error message and retry | Type checked; failure not injected |
| AP-10 | Impossible dates such as 31 February accepted by demo parser | Validate calendar date | Regression |
| AP-11 | Upcoming interviews could include applications no longer at Interview status | Filter active Interview status | Code inspection and overview smoke check |

### Current boundaries
Data is intentionally in memory and resets on refresh or hot reload. A code reload invalidated an early temporary test record; edit was repeated successfully on a fresh record after changes. This is not database persistence yet.
Email analysis uses labelled demo rules, not a real LLM. No Gmail connection, authentication, sending or deployment has been implemented.

## Stage 2 — Backend and database (next)
Implement FastAPI endpoints and PostgreSQL storage for applications, timeline events and imported emails. Use Pydantic validation, SQLAlchemy models and Alembic migrations. Include health checks, consistent errors, environment configuration and focused API tests. Acceptance: create/read/update/delete persist across backend restart; invalid data rejected; timeline changes stored transactionally.

## Stage 3 — Connect frontend and backend
Replace in-memory service with API requests while retaining existing screens and TanStack Query hooks. Configure API base URL and CORS; show useful network failure states. Acceptance: UI CRUD survives refresh, overview reflects stored records, loading/errors behave correctly. Keep demo extraction visibly labelled until real extraction is implemented.

## Subsequent stages
4. Authentication and per-user data ownership before exposing personal records.
5. Real LLM extraction with validated output, evidence excerpts and reviewed saving.
6. Gmail OAuth import, narrow scopes, protected tokens, disconnect and duplicate-safe sync.
7. Follow-up drafts and reminders; user reviews drafts before any sending feature.
8. End-to-end tests, security checks, deployment and operational verification.
9. README, architecture diagram, demonstration, interview explanations and measured resume claims.

## Learning topics
Frontend: React state, components, TypeScript types, routing, forms, TanStack Query cache invalidation, responsive CSS.
Backend: HTTP/REST, FastAPI, Pydantic, SQL relationships, transactions, migrations, error handling, API tests.
Integration: CORS, environment variables, async requests, persistence, loading/error states.
Later: OAuth, token protection, structured LLM output, idempotency, background jobs, deployment.

## Daily log template
Date / stage / intended behavior / files changed / bug symptom / root cause / fix / checks run and results / remaining limitations.
Record actual evidence rather than inventing errors or claiming unimplemented features.


## Stage 2 progress — 12 October 2026
Backend implemented: FastAPI, SQLAlchemy, Alembic migration, PostgreSQL Compose configuration, reviewed-email import storage, timeline events, consistent validation/errors, and local startup script.
Dependency installation completed using Python 3.12; compatibility check passed. Full local suite: 17 passed, 0 failed, 1 skipped (PostgreSQL concurrency test). Alembic configuration warning fixed and migration consistency recheck passed. Tested dependencies frozen in requirements-lock.txt.
PostgreSQL integration and live server verification remain pending because this session cannot access Docker's named pipe. Do not mark Stage 2 fully verified until the PostgreSQL run passes. See ApplyPilot-Stage2-Test-Report.md for the exact test outcomes and installation issues.

## PostgreSQL verification completed — 12 October 2026
User-provided PowerShell output confirms PostgreSQL 17 container healthy, migrations successful, and all 18 API tests passed against PostgreSQL in 3.63 seconds (0 failures, 0 skipped). This includes the concurrent duplicate-import test previously skipped under SQLite. One non-blocking Starlette TestClient/httpx deprecation warning remains.
Uvicorn reported successful application startup on 127.0.0.1:18083. GET / and /favicon.ico returned expected 404 responses because no root page or favicon route is defined; interactive API documentation is at /docs.
Stage 2 complete. Frontend integration remains Stage 3. Docker-volume persistence across a container restart has not been separately exercised; API recreation persistence is covered by the passing suite.

## Stage 3 implementation — 12 October 2026
Connected frontend CRUD and reviewed-email saves to the running FastAPI/PostgreSQL backend. Added configurable VITE_API_BASE_URL, 15-second request timeout, readable network/validation errors, null-to-optional normalization, and distinct missing-record versus unavailable-server handling. Removed mock-workspace/reset-on-refresh labels and misleading existing-sample labels. Disabled automatic query retries for prompt error feedback.
Validation: full TypeScript check passed; 12 client/integration checks passed against the running PostgreSQL API. Browser create and edit both survived a full page reload, and the temporary browser test record was deleted through the UI. Integration tests cleaned up their own temporary records.
Production build attempt was blocked by Windows spawn EPERM in Vite configuration loading. Updated outputs/Verify-ApplyPilot.ps1 now checks Stage 3 instead of the obsolete mock-service tests; user PowerShell build result is pending. Do not claim the revised production build is verified until that command passes.
Code locations and a source archive are available in ApplyPilot-Code-Guide.md and ApplyPilot-Source.zip. Email extraction remains demo rules; no real AI/Gmail/authentication added in this stage.

## Stage 3 verified complete — 12 October 2026
User-provided PowerShell output at 01:27 confirms: "Stage 3 type checks, 12 integration/client checks and production build passed." This resolves the pending production-build check above. Stage 3 is complete: frontend connected to FastAPI/PostgreSQL, persistence verified across browser refresh, and client/integration checks plus production compilation passed. Build completion does not mean the app has been deployed. Authentication, real AI extraction and Gmail integration remain later stages.

## Step 4 implementation — accounts
Added account/session models and migration 0002, scrypt hashing, HttpOnly cookie sessions, sign-in/up/out, ownership checks on all application operations, owner-scoped email deduplication, CSRF origin validation, no-store API responses, and per-process IP/email throttling. Frontend adds account gate, sign-out, and cache clearing on user changes. Legacy data transfer requires an explicit local command, avoiding accidental first-user takeover.
Tests: 29 backend tests passed with PostgreSQL configured (migration-preservation subtest uses isolated SQLite), 8 frontend client checks passed, TypeScript passed. Live backend restart, account UI smoke test and new production build still pending. See ApplyPilot-Stage4-Guide.md for startup and data-transfer instructions. Do not mark Step 4 fully verified yet.

### Step 4 startup issue
User-run account migration and all 29 PostgreSQL tests passed. New Uvicorn process failed with WinError 10048 because the old backend PID 17232 was still listening on port 18083. Read-only checks confirmed that listener and /api/auth/me returned 404. Added Restart-ApplyPilot-Backend.ps1, which checks listener command line and ApplyPilot health identity before stopping it, then starts the updated backend without repeating installation/tests. Actual restart remains to be run in user PowerShell.

### Step 4 live account check
User screenshots show the Import email page with account email and Sign out button, confirming the account gate was passed in the live app. Another screenshot shows the sign-in form without the earlier connection error. This does not independently verify sign-out/re-login or legacy-data transfer. Production build verification remains pending; run the updated Verify-ApplyPilot.ps1. Demo analysis label correctly remains present.

## Step 4 verified complete — 12 October 2026
User-provided output at 02:12 confirms: "Stage 4 type checks, 8 client checks and production build passed." Combined with the 29 passing PostgreSQL backend tests and the live signed-in screenshot, Step 4 account implementation and verification are complete. No new test failures reported. The pre-existing Aether Shield record's optional local transfer has not been confirmed; this is tracked separately and must not be described as completed. Public deployment, email verification/password recovery, real AI extraction and Gmail integration remain later work.


## Stage 5 implementation and verification — 12 October 2026
Replaced frontend demo extraction with authenticated backend Gemini structured extraction. Added source evidence checks, validated fields, explicit unknowns, safe provider errors, account-scoped matching and duplicate short-circuiting. Analysis remains read-only until reviewed save. Key configured privately by the user; live fictional Gemini request passed. No key included in documentation or source archive.
Tests: 46 backend tests passed against PostgreSQL, 0 failed, 1 existing deprecation warning; TypeScript passed; 12 frontend client checks passed. Production build blocked here by Windows spawn EPERM; user-run Verify-ApplyPilot.ps1 and backend restart requested. Browser verification pending. See ApplyPilot-Stage5-Guide.md for changes, topics and actual issues encountered. Stage 5 implementation is done, final build/browser checks still pending.

Additional response-envelope regression: a malformed provider JSON envelope is handled as a sanitized 502. All 14 provider-only checks passed after this fix (4 database integration checks deselected in this targeted rerun). Total implemented backend tests: 47; the preceding full run covered 46.


## Stage 5 browser workflow confirmed
User confirmed backend restart; endpoint inspection found /api/analysis and PostgreSQL readiness returned ready. The browser initially displayed "Gemini is unavailable". A later direct request with the same fictional interview sample returned HTTP 200 and correctly extracted six fields. The original provider status was not captured, so its exact cause is unconfirmed; a temporary provider failure is suspected, not proven.
User screenshots subsequently confirmed the review screen with source quotes, followed by the saved Northwind Analytics / Data Analyst / Interview record. User confirmed it remained after refresh. Core analyse -> review -> save -> persistence flow is verified. No further real Gemini requests or full regression runs are needed for this checkpoint.
Remaining Stage 5 verification: production-build success output has not been supplied. A newer .output/nitro.json artifact was observed, but this alone does not prove a successful full build. Duplicate short-circuiting already passed automated tests; a manual duplicate check is optional. Gmail integration remains a later stage.


## Stage 5 verified complete — 12 October 2026
User supplied the successful Stage 5 type checks, 12 client checks and production-build output (02:23:23). Backend startup completed on port 18083. Logs show two earlier /api/analysis 503 responses, followed by /api/analysis 200, /api/imports 201 Created, and subsequent /api/applications 200 responses. Together with the screenshots and refresh confirmation, this verifies the full live workflow and resolves all pending Stage 5 build/browser checks. Original provider failure cause remains unconfirmed; no additional retries or tests were run for this documentation update. Stage 5 complete. Gmail integration remains future work.
