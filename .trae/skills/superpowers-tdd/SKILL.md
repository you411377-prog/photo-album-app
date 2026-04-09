---
name: "superpowers-tdd"
description: "Enforces RED-GREEN-REFACTOR for logic changes. Invoke when adding behavior, fixing reproducible bugs, or changing code that benefits from regression protection."
---

# Superpowers TDD

Use this skill to apply strict test-driven development where it adds meaningful confidence.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-tdd`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here when the task benefits from RED-GREEN-REFACTOR or regression protection.
- If the user names no skill, this skill may still be selected when the request is clearly about adding behavior safely with tests or fixing a reproducible bug via TDD.

## When To Invoke

Invoke when:

- Adding business logic or user-visible behavior.
- Fixing a reproducible bug.
- Refactoring risky code with stable expected behavior.
- The code path can regress silently without tests.

Do not force this skill for tiny low-risk edits where a test harness is unavailable or disproportionate.

## Cycle

1. Write a failing test that captures the intended behavior.
2. Run it and confirm it fails for the expected reason.
3. Write the smallest implementation needed to pass.
4. Run the test and confirm it passes.
5. Refactor only if behavior is preserved.
6. Re-run relevant verification after refactoring.

## Rules

- The failing test must exist before the fix or feature code.
- Keep tests focused on behavior, not implementation details.
- Prefer the smallest scope that proves the change.
- If no formal test harness exists, use the lightest reliable reproducible check available.

## Good Outcomes

- Clear RED evidence
- Minimal GREEN implementation
- Safe REFACTOR step
- Reduced regression risk

## Example Triggers

- "Add this logic safely with tests."
- "Fix this bug with a failing test first."
- "Use TDD for this refactor."
