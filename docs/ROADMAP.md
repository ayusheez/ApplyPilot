# Original development roadmap (authoritative)

1. Frontend — completed.
2. Backend and database — completed for application tracking. Persistent analysis jobs belong to Stage 8.
3. Frontend/backend integration — completed.
4. Real email extraction — implemented and verified; previously called Stage 5 after accounts were moved earlier.
5. Reliable imports — duplicate protection and matching implemented; older/undated overwrite guard and attach-only flow added. Targeted automated checks pass; new UI smoke check pending.
6. Follow-up assistance — existing reminders and upcoming interviews reused; editable context-based template and copy action added. No auto-send or paid API calls. Complete: production build and draft edit/copy browser check verified.
7. Test and deploy public fictional-data demo — pending.
8. Authentication and Gmail — accounts completed early; Gmail OAuth, encrypted tokens, selected-email jobs and manual local review implemented. Live migration/build/OAuth verification pending. Private-email AI extraction remains separate.
9. Documentation and interview preparation — documentation ongoing; consolidation pending.

The existing `stage-5` Git tag and dated ZIP use the earlier numbering and remain untouched. `stage-6-follow-ups` is the current work branch; `stage-6-gmail` is an earlier name, not evidence that Gmail was implemented.
