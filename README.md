# ApplyPilot

A job application tracker with a React/TypeScript frontend, FastAPI backend, PostgreSQL persistence and Gemini-assisted extraction from pasted emails.

## Stage 5
Session-based accounts, user-specific application records, status timelines, AI extraction with source quotes, editable review before saving, and duplicate-email detection. Gmail connection and deployment are not included yet.

- `pixel-perfect-view-8651-main/`: frontend, originally scaffolded with Lovable and subsequently extended.
- `backend/`: API, database migrations and tests.
- `docs/`: development log and Stage 5 verification notes.

See the frontend and backend guides for setup. Install dependencies and configure local environment variables before running. Secrets and database contents are not committed. Gemini requires a configured API key and available quota.

The `stage-5` tag preserves the verified local demo. Further Gmail integration work uses the `stage-6-gmail` branch.


## Gmail (Stage 8)
Read-only Gmail connection and selected-email local review are implemented on `stage-8-gmail`; live verification is pending. See docs/ApplyPilot-Stage8-Guide.md. The historic stage-5 tag predates Gmail. Do not send personal email contents to the unpaid Gemini demo.
