---
name: "superpowers-planning"
description: "Writes a detailed implementation plan for multi-step work. Invoke after requirements are clear and before touching code on non-trivial changes."
---

# Superpowers Planning

Use this skill to turn an approved design or clear requirement into a concrete implementation plan.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-planning`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here after requirements are clarified and the task needs a concrete plan.
- If the user names no skill, this skill may still be selected when the request is clearly about planning, task breakdown, or implementation sequencing.

## When To Invoke

Invoke when:

- The work spans multiple files or steps.
- The user wants a plan before coding.
- The task needs explicit verification strategy.
- Another skill has already clarified the design.

Do not invoke for tiny edits that can be completed safely in one step.

## Required Process

1. Restate the implementation goal in one sentence.
2. Identify the files likely to be created or modified.
3. Break the work into bite-sized tasks.
4. Make each task independently verifiable.
5. Prefer minimal scope, DRY, YAGNI, and focused changes.
6. Explicitly note how to validate each task.
7. After plan approval or acceptance, hand off to `superpowers-execution`.

## Plan Quality Bar

Every plan should:

- Use exact file paths when known.
- Separate tasks clearly by responsibility.
- Avoid placeholders like "handle edge cases later".
- Include verification steps, not just implementation steps.
- Be detailed enough that another agent can execute it without guessing.

## Task Format

For each task, include:

- Objective
- Files to create or modify
- Main code change
- Verification method
- Risks or assumptions, if any

## Example Triggers

- "Make an implementation plan."
- "Break this feature into steps."
- "Plan this refactor before coding."
- "What files should we touch and in what order?"
