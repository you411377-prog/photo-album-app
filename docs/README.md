# Documentation Guide

This directory is the working home for product, planning, and decision records.

## Structure

- `docs/prd/current.md`: current source of truth PRD
- `docs/prd/CHANGELOG.md`: version and scope changes
- `docs/prd/deviations/`: records created during development when implementation diverges from the PRD
- `docs/prd/archive/`: archived PRD snapshots
- `docs/plans/`: implementation plans
- `docs/decisions/`: architecture and product decisions

## Governance Flow

1. Start from `docs/prd/current.md` before major work.
2. If scope, user-visible behavior, acceptance criteria, or constraints change, update the PRD or add a deviation record first.
3. Keep `docs/prd/CHANGELOG.md` in sync when the current PRD meaningfully changes.
4. When the change affects implementation approach but not product scope, record it in `docs/decisions/`.
5. Keep implementation plans in `docs/plans/` aligned with the latest PRD.

## Minimum Rules

- Feature or behavior change: update `docs/prd/current.md` or add a file under `docs/prd/deviations/`
- Approved PRD update: add an entry to `docs/prd/CHANGELOG.md`
- Non-trivial implementation work: create or update a plan in `docs/plans/`

## PRD Sync Check

Run the check locally:

```bash
npm run check:prd-sync -- --staged
```

Run it against a branch range in CI:

```bash
npm run check:prd-sync -- --base origin/main --head HEAD
```

Test it with an explicit file list:

```bash
npm run check:prd-sync -- --files src/App.jsx,docs/prd/deviations/DEV-0001-example.md
```
