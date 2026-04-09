# PRD Deviations

Create one file per in-development deviation when implementation no longer matches the current PRD.

Use this directory when:

- scope grows during development
- user-visible behavior changes
- constraints force a product compromise
- implementation must proceed before the full PRD rewrite is ready

After the deviation is approved, fold it back into `docs/prd/current.md` and record the update in `docs/prd/CHANGELOG.md`.
