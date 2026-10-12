# ApplyPilot backend — Stage 2

Local single-user FastAPI API with SQLAlchemy and PostgreSQL. No paid service or API key is needed.

## Windows startup

Run `outputs/Start-ApplyPilot-Backend.ps1` from the workspace in an ordinary PowerShell window. Docker Desktop must be running. The script installs pinned packages in `.venv312`, creates a random local database password in `.env` on first run, starts PostgreSQL on loopback port 15432, applies migrations, runs tests in a separate `applypilot_test` database, then starts the API on loopback port 18083.

Open http://127.0.0.1:18083/docs to try the endpoints. `/health` checks the API; `/ready` checks database connectivity and application schema. Keep the terminal open. Ctrl+C stops the API. The named Docker volume preserves database records. Do not delete the volume to stop the project; `docker compose stop` retains it.

`.env` contains a local credential: keep it out of Git and screenshots. Existing `.env` files are preserved. Changing the password in that file does not change credentials inside an existing PostgreSQL volume.

## API contract

| Method | Path | Behavior |
|---|---|---|
| GET | /health | Liveness |
| GET | /ready | Database/schema readiness |
| GET | /api/applications | Applications, newest updated first |
| POST | /api/applications | Create application and initial timeline event; 201 |
| GET | /api/applications/{id} | Full record; 404 when absent |
| PATCH | /api/applications/{id} | Partial update with status/note/detail events |
| DELETE | /api/applications/{id} | Delete record, timeline and source emails; 204 |
| POST | /api/imports | Save reviewed email and fields atomically; 201, duplicate 409 |

Requests/responses use camelCase fields matching the frontend. Optional unset response fields may be null; the Stage 3 client adapter must account for this. PATCH omits unchanged fields; null or empty string clears optional dates/URL/action. Required fields cannot be null. HTTP(S) job links only. Dates must be real ISO calendar dates. Invalid input returns 422 with an `error` object; missing records 404, duplicate imports 409, database errors 503. Validation responses omit submitted values to avoid echoing private email contents.

Example create body:

```json
{"company":"Example Labs","role":"Backend Engineer","status":"Applied","appliedOn":"2026-10-12","notes":"Referral requested"}
```

Import shape: `{ "email": { "subject": "...", "body": "..." }, "fields": { "company": "...", "role": "...", "status": "Applied" }, "targetApplicationId": null }`. Set the target ID to update an existing application. Missing optional extracted values preserve existing dates/actions. Use PATCH to explicitly clear them.

## Storage and consistency

Applications own timeline events and source emails via foreign keys. Changes and events commit in one transaction. Updates lock the application row on PostgreSQL. Normalized subject/body SHA-256 fingerprints have a unique constraint to prevent duplicate imports, including concurrent saves. This is single-user deduplication; scope the constraint to the authenticated user before adding multiple accounts.

Alembic revision `0001` creates the schema. Runtime never silently creates tables. Tests check migration/model consistency and persistence across application recreation. PostgreSQL tests additionally exercise concurrent duplicate requests.

## Verification

`python -m pytest -q` defaults to isolated temporary SQLite databases for fast logic checks. Set TEST_DATABASE_URL to the dedicated PostgreSQL `applypilot_test` database for integration checks. PostgreSQL tests clear only that database's application tables; never point tests at real data. The startup script configures this automatically. Tests include validation, CRUD, timeline, restart persistence, imports, rollback, deletion cascade, CORS and migrations.

## Boundaries

Frontend still uses its Stage 1 mock service until Stage 3. This stage stores reviewed email data; it does not perform LLM analysis, Gmail OAuth, send emails, provide authentication or deploy the app. Bind locally until authentication and per-user ownership are implemented. The list endpoint is adequate for the personal MVP; pagination and email-body-on-demand are future scaling work.

Step 4 update: accounts and sessions are now required. See ACCOUNTS.md for authentication, setup, data ownership and legacy-record transfer. Earlier single-user boundaries in this README describe pre-account stages.


## Stage 5: email analysis
Set GEMINI_API_KEY in server-only .env and restart the API. GEMINI_MODEL defaults to gemini-3.8-flash. POST /api/analysis accepts EmailInput under the same session and Origin requirements as imports. It returns a duplicate reference or validated extraction for review; it does not save data. Provider errors are sanitized. No Gmail connection or automatic sending is implemented. See outputs/ApplyPilot-Stage5-Guide.md for verification and privacy details.
