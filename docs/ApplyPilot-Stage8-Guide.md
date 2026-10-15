# Original Stage 8 — Gmail integration

## Implemented
- Read-only Gmail OAuth with state bound to the logged-in ApplyPilot session, a 10-minute expiry, single-use state consumption, and PKCE.
- Access and refresh tokens encrypted with Fernet in PostgreSQL. Encryption key stays only in backend .env; retain it securely so tokens/pending imports can be decrypted.
- Token refresh on demand, clear expired/revoked-access errors, and explicit reconnect.
- User-initiated Gmail search with five results per page. Fetch full text only when the user selects Review. Attachments are excluded; HTML is converted to text without rendering active content. Received dates use Gmail internalDate in UTC.
- Selected-email jobs persist across refresh/restarts. Pending email text is encrypted; saved imports reuse existing source email records. A fetch interrupted for over two minutes is reported as failed when pending imports are loaded. Retry is manual, not a background loop.
- Per-user/mailbox/message id uniqueness plus the existing content fingerprint prevents duplicate saves. Server reloads the stored email when saving, rather than trusting replacement client text. Saving the application and completing its job happen in one transaction.
- Account-scoped resume/discard and disconnect. Disconnect removes local tokens, OAuth states and pending previews; attempts Google token revocation and reports if that could not be confirmed. Existing applications/source emails remain; delete an application through the app to remove its saved source emails.
- Uvicorn startup helpers disable access logs so OAuth codes in callback query strings are not logged. No tokens or email content are intentionally logged.

## Personal email boundary
Gmail review is LOCAL and MANUAL in this release: users fill company, role, status, and dates, or choose an existing application. Real Gmail messages are never routed to Gemini by this flow. The pasted-email Gemini feature is labelled for fictional/non-personal samples only. A suitable local model or permitted provider arrangement for automatic private-email extraction remains separate work.

## Verification checkpoint
Eight mocked backend tests passed (10.93 seconds); no live Google/Gemini calls or mailbox access made. Covers OAuth scope/PKCE/replay, expiration and other-account rejection, encrypted storage, pagination response, prepare/resume/save/deduplication, tenant isolation, refresh, disconnect cleanup and revocation failure, failed-job persistence, HTML stripping, and no AI call for Gmail imports. TypeScript passed after correcting exactOptionalPropertyTypes handling.
Migration 0003 was exercised in temporary SQLite test databases. Live PostgreSQL migration, production build and user-authorized Google connect/search/review/save/disconnect smoke checks remain pending. Do not call Stage 8 fully verified yet. Existing databases are not reset and no existing application data is intentionally removed.

## Run locally
1. Keep Docker PostgreSQL and the frontend running. Use http://127.0.0.1:5174 consistently (not localhost) for the configured Google callback.
2. Run outputs/Restart-ApplyPilot-Backend.ps1: this applies additive migration 0003 and starts the updated API with access logging disabled.
3. Run outputs/Verify-ApplyPilot.ps1 in another terminal for frontend production verification.
4. Open Import email -> Connect Gmail. Authorize your registered Google test account and the read-only Gmail permission.
5. Find emails -> Review one -> enter application fields -> Save. Refresh to check persistence. Selecting the same email again should open its existing-record notice.
6. Disconnect Gmail when desired. Saved applications remain. If revocation is unavailable, remove access in Google Account connections manually.

Google testing-mode Gmail refresh tokens may expire after seven days; reconnecting is expected. A public Gmail-connected product needs separate verification and privacy work. Stage 7 deployment remains paused.

References:
https://developers.google.com/identity/protocols/oauth2/web-server
https://developers.google.com/identity/protocols/oauth2
https://developers.google.com/workspace/gmail/api/reference/rest/v1/users.messages/list
https://ai.google.dev/gemini-api/terms


## Stage 8 local release checkpoint verified
User supplied Stage 8 type checks, 12 client checks and production-build success (21:33:42). Screenshots verify duplicate-email detection; user reports saved applications remain after the disconnect check. Live connection, selected-email manual review, save and refresh persistence were already confirmed. Local Gmail integration workflow is verified; Google-side revocation was not independently inspected. No tests repeated. Personal Gmail AI extraction and automatic syncing are not implemented. Stage 7 deployment remains paused; Stage 9 documentation/interview consolidation remains outstanding.
