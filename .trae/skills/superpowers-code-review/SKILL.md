---
name: "superpowers-code-review"
description: "Reviews changes for correctness, risk, and test gaps. Invoke after implementation, before hand-off, or when the user explicitly asks for a review."
---

# Superpowers Code Review

Use this skill to review completed or nearly completed changes with a bug-finding mindset.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-code-review`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here near the end of execution or before final hand-off.
- If the user names no skill, this skill may still be selected when the request is clearly about code review, bug finding, regression risk, or verification gaps.

## When To Invoke

Invoke when:

- Implementation work is done or mostly done.
- A plan task has been completed and should be checked.
- The user asks for a review.
- You want a final correctness and regression pass before hand-off.

## Review Priorities

1. Correctness
2. Behavioral regressions
3. Edge cases and failure handling
4. Security and data integrity
5. Missing or weak verification
6. Maintainability issues that create real risk

## Output Rules

- Lead with findings, ordered by severity.
- Reference exact files and symbols when possible.
- Explain why each finding matters.
- Call out missing tests only when they materially affect confidence.
- If no findings are found, say so explicitly and mention residual risks.

## Review Checklist

- Does the code match the intended spec or task?
- Can the change break existing flows?
- Are error paths handled well enough?
- Is the scope minimal and consistent?
- Was the change verified appropriately?

## Example Triggers

- "Review this before we merge."
- "Check this change for bugs."
- "Audit this implementation for regressions."
