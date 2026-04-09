---
name: "prd-governance-init"
description: "Initializes a reusable PRD governance skeleton in the current project. Invoke when setting up docs/ structure, PR templates, governance skill, and PRD sync checks for new or existing repos."
---

# PRD Governance Init

Use this skill to scaffold a standard PRD governance skeleton so projects can keep product docs aligned with implementation. It creates the required `docs/` structure, governance skill, PR template, and a `check:prd-sync` script that can run locally or in CI.

## When To Invoke

Invoke when:

- starting a new project and you want PRD governance from day one
- retrofitting an existing project that lacks PRD documentation discipline
- standardizing multiple repos to use the same governance layout

Do not invoke for trivial repos that won't maintain product documentation.

## Relationship To `superpowers` And `prd-governance`

- This is a peer skill under `.trae/skills/`.
- `prd-governance-init` scaffolds files and scripts.
- `prd-governance` governs documentation during development.
- `superpowers` orchestrates design → planning → execution; use `prd-governance` in parallel whenever documentation must be updated.

## What It Creates

- `docs/` directory with:
  - `docs/prd/current.md` (active PRD)
  - `docs/prd/CHANGELOG.md`
  - `docs/prd/deviations/` (+ template)
  - `docs/prd/archive/`
  - `docs/plans/` (+ plan template)
  - `docs/decisions/` (+ ADR template)
  - `docs/README.md` (usage guide with `check:prd-sync` examples)
- `.trae/skills/prd-governance/SKILL.md` (governance skill)
- `.github/pull_request_template.md` (PR checklist)
- `scripts/check-prd-sync.mjs` and `package.json` script entry

## How To Use

1. Run the installer script in the target repo:
   - `node scripts/install-prd-governance.mjs --init`
   - If the repo is empty, you can copy the installer first and then run it.
2. Confirm `npm run check:prd-sync` works locally:
   - `npm run check:prd-sync -- --staged`
3. Add a CI step (optional) to run `npm run check:prd-sync` on every PR.

## Notes

- The installer avoids overwriting existing files unless `--force` is specified.
- The check script supports `--base/--head` for CI branch comparisons and `--files` for explicit lists when no git context is available.

## Example Triggers

- "Initialize PRD governance for this repository."
- "Set up reusable PRD docs and sync checks."
- "Create a template we can apply to new projects."
