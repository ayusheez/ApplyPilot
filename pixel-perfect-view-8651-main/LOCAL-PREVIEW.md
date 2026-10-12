# Run ApplyPilot locally

Frontend: React + TypeScript, TanStack Router/Query, Tailwind.
Backend: FastAPI + SQLAlchemy + Alembic + PostgreSQL.

Run outputs/Start-ApplyPilot-Backend.ps1 in one PowerShell window, then outputs/Start-ApplyPilot.ps1 in another. Keep both open. Frontend: http://localhost:5174. API docs: http://127.0.0.1:18083/docs.

The frontend now uses PostgreSQL-backed API requests. No fictional applications are inserted automatically. Add an application or import a sample email. Refreshing retains saved data.

VITE_API_BASE_URL defaults to http://127.0.0.1:18083. Override in .env.local before starting/building the frontend; this URL is public configuration, never a secret. The backend CORS_ORIGINS must include the frontend origin. Restart Vite after changing environment files.

Email extraction still uses labelled local demo rules. Review before saving; source email and application changes are stored in PostgreSQL. Real AI, Gmail and authentication come later.

Run outputs/Verify-ApplyPilot.ps1 with the backend running for TypeScript checks, 12 client/integration checks, and production build. It creates and cleans up only its own temporary test records.

scripts/stage1-regression.cjs is a historical mock-service test and is superseded by scripts/stage3-integration.cjs. Do not use it against the API client.

Step 4 update: the app now requires an account and uses HttpOnly session cookies. The API hostname must match the frontend hostname (localhost with localhost, or 127.0.0.1 with 127.0.0.1). Default URL is derived from the browser hostname. The current verification script runs 8 Stage 4 client checks; earlier Stage 3 commands in this document are historical. See outputs/ApplyPilot-Stage4-Guide.md for account setup and transferring legacy data.
