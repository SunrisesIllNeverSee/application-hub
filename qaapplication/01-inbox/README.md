# 01-inbox/ — Raw Drops

**Step 1** of the pipeline. Drop new raw captures here (HTML dumps,
markdown exports, screenshots — anything that contains an application).

Flat folder, no subfolders. Files leave this folder when they get
extracted into `../07-apply/<slug>.md` (if waiting to be filled) or
straight to `../04-applications/<slug>.md` (if already submitted), with
the raw moving to `../07-apply/_shared/raw/<slug>.<ext>` for audit
and an entry appended to `../audit-log.md`.

If a capture contains multiple programs at once (e.g. a tabs export with
14 URLs), it goes to `../02-processing/` for triage instead.
