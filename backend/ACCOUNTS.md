# ApplyPilot Step 4 — Accounts and private workspaces

## Implemented
- Email/password registration and sign-in; minimum 12-character passwords.
- Salted scrypt password hashes (N=32768, r=8, p=3). Passwords are not stored as plaintext.
- Random 7-day sessions in HttpOnly, SameSite=Lax cookies; only token hashes stored in PostgreSQL.
- Sign-out revokes the session in the database; sign-in rotates the current session.
- Every application endpoint checks the session and record owner. Other users' IDs return 404.
- Imported-email duplicate detection scoped per user.
- Strict origin checks for state-changing requests, credentialed CORS for configured frontend origins, and no-store caching for API responses.
- Login/registration throttling by IP and email within one server process.
- Frontend account gate, account display, sign-out, session expiry handling and query-cache clearing on account changes.

## Verification
29 backend tests passed against PostgreSQL (0 failures/skips), including ownership isolation, cross-user import rejection, session expiry/revocation/rotation, CSRF rejection, throttling, and migration preservation. The migration-preservation test uses an isolated SQLite legacy database; the API suite uses PostgreSQL.
8 frontend client tests passed. TypeScript check passed.
One non-blocking Starlette/httpx TestClient deprecation warning remains.
Live account UI verification and the revised production build remain pending until the running backend is restarted.

## Load the new version
1. In the backend PowerShell window, press Ctrl+C.
2. Run Start-ApplyPilot-Backend.ps1 from outputs. It applies migration 0002, runs the tests, then starts the API.
3. Refresh http://localhost:5174 and create your account. Enter your password in the app, not in chat.
4. Run Transfer-ApplyPilot-Data.ps1 from outputs. Enter your account email when prompted. This local-only operation assigns previously unowned applications to that account. It does not delete applications or expose an automatic public claim endpoint.
5. Run Verify-ApplyPilot.ps1 from outputs to verify frontend types, the 8 client checks, and production compilation.

## Existing Aether Shield record
Migration 0002 preserves existing applications and marks them unassigned. Registration never automatically claims old records. They become visible after the explicit local transfer. Run transfer after creating your account; a second run transfers zero records. No password is needed for this local maintenance command.

## Local cookie setup
Use the same hostname for frontend and API. The default client derives localhost or 127.0.0.1 from the browser's hostname. If setting VITE_API_BASE_URL manually, keep its hostname aligned with the frontend. Example: frontend localhost:5174 and API localhost:18083. Restart Vite after environment changes.

## Deployment boundaries
Set COOKIE_SECURE=true when serving through HTTPS. Keep CORS_ORIGINS restricted to the deployed frontend. Throttling currently lives in one process; add shared rate-limit storage before multiple workers/instances. Email verification and password recovery are not implemented yet; no verification claims are made by the UI. Configure those before opening public registration. This stage does not connect Gmail or add real AI extraction.

## Code
Backend: app/auth.py, app/claim_legacy.py, models.py, main.py, migrations/versions/0002_accounts.py, tests/test_auth.py.
Frontend: src/components/AuthGate.tsx, src/lib/auth.ts, http-client.ts, AppShell.tsx, routes/__root.tsx, scripts/stage4-client.cjs.

Stage 1 and Stage 3 service tests are historical. The current Verify-ApplyPilot.ps1 uses Stage 4 client tests; authenticated API integration is covered by the backend test suite.
