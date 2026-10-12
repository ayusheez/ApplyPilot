# ApplyPilot Stage 5 — Gemini email extraction

Implemented 12 October 2026. Real Gemini integration is implemented and a live fictional-email request passed. The user has verified the live browser analyse-review-save-refresh flow. Production build confirmed by user output at 02:23:23; Stage 5 is complete.

## What changed
- Import email now calls authenticated POST /api/analysis instead of the frontend pattern parser.
- The backend sends only the submitted subject, sender, received date and body to Gemini. It does not send stored applications, passwords or session cookies.
- Gemini returns structured company, role, status, interview date, follow-up date and next action, each with a supporting quote.
- Pydantic validates the response, allowed status values, dates and field lengths. Unsupported source quotes are removed and shown as warnings. This checks source presence, not whether every AI interpretation is correct: review remains required.
- Existing emails are detected per account before calling Gemini. Existing applications are matched locally by normalized company AND role; ambiguous matches are left unselected.
- Analysis does not write to the database. Edit the review fields and press Save/Update to persist the email and application.
- Missing keys, quota exhaustion, network failures, timeouts and invalid or blocked model output produce useful errors. There is no silent demo fallback or automatic retry.
- Unknown extraction values remain explicit nulls; ordinary application responses retain their previous optional-field normalization.

## Technology and topics
Python, FastAPI, HTTPX, Gemini generateContent REST API, JSON Schema, Pydantic, React, TypeScript, PostgreSQL and SQLAlchemy. Topics: server-side secrets, structured LLM output, untrusted-input prompts, source evidence, error handling, session authentication, tenant isolation, duplicate protection and human review.

## Configure and run
The Gemini key is stored only in backend/.env (excluded from source archives). Configure-ApplyPilot-AI.ps1 prompts without showing the key. Use a free-tier project without billing. Quotas and availability depend on the Google project; this app does not configure billing or switch to another paid provider.

After setup, run outputs/Restart-ApplyPilot-Backend.ps1 in PowerShell. Keep the backend and frontend terminals open. Refresh http://127.0.0.1:5174/import, select a fictional sample, click Analyse email, review the extracted fields, and save. Import the same email again to see duplicate detection.

Free-tier email contents may be used by Google to improve products. The form discloses that analysis sends the email to Gemini. Start with fictional examples and remove sensitive content.

## Verification evidence
- 46 backend tests passed against the dedicated PostgreSQL test database; 0 failed. Includes 17 new analysis checks and the 29 existing tests. Existing non-blocking Starlette/httpx deprecation warning remains.
- TypeScript type check passed.
- 12 client checks passed (8 existing + 4 AI request/null/duplicate/quota checks).
- Live Gemini request passed with fictional Example Labs / Backend Engineer email: correct company, role, Applied status and source quotes; unknown dates and next action stayed null.
- Production build passed in user PowerShell at 02:23:23, along with TypeScript and all 12 client checks. This resolves the earlier session-only Windows spawn EPERM blocker.
- Browser flow verified by user screenshots and refresh confirmation: Northwind Analytics / Data Analyst / Interview was extracted, reviewed, saved and remained visible after refresh.

## Bugs and fixes
1. The generic HTTP client removed all nulls, which would break the extraction contract. AI responses now preserve nulls; a regression check covers it.
2. The ordinary 15-second API timeout was too short for AI calls. Analysis now has a 60-second frontend timeout; backend HTTPX uses 45-second operation timeouts and a 10-second connection timeout.
3. A Windows text-edit helper used the system encoding and failed on UI punctuation. Re-ran the affected edit using explicit UTF-8; no source content was lost.
4. Build verification encountered the existing Windows child-process restriction. Type and client checks passed; build moved to the user's PowerShell.

## Scope and limitations
This stage analyses pasted emails only. Gmail OAuth, automatic syncing, AI summaries and follow-up draft generation are not implemented here. No new database migration is needed. Source-quote matching cannot guarantee semantic accuracy or fully prevent prompt injection; the provider has no tools and all suggestions require review. Public deployment still needs operational quota controls and the previously documented account hardening.

References: https://ai.google.dev/gemini-api/docs/structured-output and https://ai.google.dev/gemini-api/docs/pricing

Additional response-envelope regression: a malformed provider JSON envelope is handled as a sanitized 502. All 14 provider-only checks passed after this fix (4 database integration checks deselected in this targeted rerun). Total implemented backend tests: 47; the preceding full run covered 46.
