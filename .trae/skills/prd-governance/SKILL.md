---
name: "prd-governance"
description: "Keeps PRD, deviations, plans, and decisions aligned with implementation. Invoke when scope changes during development or when checking spec-to-code alignment."
---

# PRD Governance

Use this skill to keep product documentation aligned with what is actually being built.

## When To Invoke

Invoke when:

- a feature is added or changed during implementation
- code behavior no longer matches the current PRD
- acceptance criteria, scope, or constraints change
- the user asks whether code and PRD are still aligned
- a new implementation plan must be synced to the latest product intent

Do not invoke for purely mechanical refactors that do not change user-visible behavior, scope, or acceptance criteria.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `prd-governance`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may still route to brainstorming, planning, execution, review, or debugging. Use this skill in parallel whenever documentation governance is required.
- If the user names no skill, this skill may still be selected when the task is clearly about PRD drift, requirement changes, or spec-to-code traceability.

## Core Rules

1. Treat `docs/prd/current.md` as the active source of truth.
2. If implementation diverges from the PRD, create or update a deviation record before the drift is forgotten.
3. If the current PRD meaningfully changes, update `docs/prd/CHANGELOG.md`.
4. If implementation plans depend on outdated requirements, update the plan before continuing.
5. If a decision affects future maintenance, capture it in `docs/decisions/`.

## Required Workflow

### 1. Inspect Current State

Read:

- `docs/prd/current.md`
- relevant files under `docs/prd/deviations/`
- relevant implementation plans in `docs/plans/`
- the code paths being changed

### 2. Classify The Change

Decide whether the work is:

- PRD-consistent and no doc update is needed
- a temporary deviation that should be recorded now
- a true PRD update that changes the active baseline
- a technical decision that belongs in an ADR

### 3. Update The Right Records

Use these destinations:

- Active product requirement: `docs/prd/current.md`
- In-flight mismatch or temporary divergence: `docs/prd/deviations/DEV-XXXX-*.md`
- Version history: `docs/prd/CHANGELOG.md`
- Implementation breakdown: `docs/plans/*.md`
- Important decision: `docs/decisions/ADR-*.md`

### 4. Verify Alignment

Before closing the task, confirm:

- code behavior matches the active PRD or an approved deviation
- deviations are linked to the PRD version they modify
- plans do not point to outdated requirements
- the PR template and PRD sync script would pass

## Fast Decision Guide

- User-visible behavior changed -> update PRD or add deviation
- Acceptance criteria changed -> update PRD
- Scope expanded or reduced -> update PRD and changelog
- Constraint discovered mid-build -> add deviation first, then fold into PRD
- Pure refactor with no behavior change -> PRD update usually not needed

## Example Triggers

- "Check whether my current code still matches the PRD."
- "Record this feature drift before we forget it."
- "Update the PRD after changing the flow during development."
- "Use prd-governance to sync the docs with what we actually built."
