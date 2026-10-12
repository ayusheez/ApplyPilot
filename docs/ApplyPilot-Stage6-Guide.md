# Original Stage 6 — follow-up assistance

Overview already lists upcoming interviews and follow-ups through the next seven days, including overdue reminders. Application Edit already supports setting and clearing dates; these working features were reused.

New: application details -> Follow-up assistant -> Create follow-up draft. This is a free local template personalized with company, role and status, clearly labelled as a template. Edit text, replace [Your name], then Copy draft. Clipboard failures show manual-copy instructions. Drafts are temporary and never sent automatically. No Gemini calls are required.

Stage 5 gap: older or undated source emails cannot overwrite application fields. Comparison conservatively uses the latest application update date, applied date and received dates from saved emails. Same-day reviewed changes are allowed because received dates have day precision. Uncheck Apply reviewed fields to attach an old email without changing current details. To deliberately correct current details, use application Edit. Import saves remain transactional and duplicate checked.

Verification: 4 targeted backend checks passed in temporary SQLite databases (old email blocked and attach-only preserved details/deduplication; undated update blocked; reminder set/clear; newer reviewed update). No user database was touched. Initial test invocation failed because of wrong working directory; corrected invocation passed. Existing Starlette deprecation warning remains.

Manual checkpoint: restart backend with outputs/Restart-ApplyPilot-Backend.ps1, refresh frontend, open an application, create/edit/copy a draft. Set a follow-up date using Edit and check Overview. Run production build once via outputs/Verify-ApplyPilot.ps1. Gmail remains Stage 8.
