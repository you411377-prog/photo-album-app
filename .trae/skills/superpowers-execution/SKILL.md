---
name: "superpowers-execution"
description: "Executes an approved plan in small verified steps. Invoke after planning when implementing multi-step work, refactors, or coordinated code changes."
---

# Superpowers Execution

Use this skill to carry out an approved implementation plan in small, verified increments.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-execution`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here after design or planning has been completed.
- If the user names no skill, this skill may still be selected when the request is clearly about step-by-step implementation of an approved plan.

## When To Invoke

Invoke when:

- A design or plan has already been approved.
- The work spans multiple tasks or files.
- The task benefits from explicit checkpoints.
- You want disciplined step-by-step implementation.

## Required Process

1. Confirm the active goal and current task.
2. Implement only the current task scope.
3. Verify that task before moving to the next one.
4. Keep progress updates short and concrete.
5. Re-check files before editing if they may have changed.
6. Hand off to `superpowers-code-review` before completion when appropriate.

## Execution Rules

- Prefer small changes over big batches.
- Do not mix unrelated refactors into the same step.
- Keep the code aligned with the agreed plan.
- If the plan becomes invalid, pause and return to planning.

## Verification Expectations

- Run the most relevant local check for the task.
- Prefer focused verification before broad suites.
- Fix introduced diagnostics or lint issues before continuing.

## Example Triggers

- "Implement this plan step by step."
- "Execute the approved refactor carefully."
- "Carry out the plan with checkpoints."
