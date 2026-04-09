---
name: "superpowers"
description: "Agentic development workflow for spec-first planning, small-task execution, verification, and review. Invoke when building features, refactoring, debugging, or planning non-trivial code changes."
---

# Superpowers

Use this as the orchestration skill. It selects and invokes the appropriate sub-skill for each phase:

- Brainstorming: `superpowers-brainstorming`
- Planning: `superpowers-planning`
- Execution: `superpowers-execution`
- Debugging: `superpowers-debugging`
- TDD: `superpowers-tdd`
- Code Review: `superpowers-code-review`

## Routing And Priority Rules

This skill is the default orchestration entrypoint for the split `superpowers` workflow.

Use the following priority logic:

1. If the user explicitly says `superpowers`, treat this skill as the primary entrypoint first.
2. If the user explicitly names a sub-skill such as `superpowers-debugging`, `superpowers-planning`, or `superpowers-code-review`, that named sub-skill takes priority over this orchestration skill.
3. If the user does not name any skill and only describes a task, prefer the most task-specific sub-skill instead of forcing everything through `superpowers`.

Examples:

- "Use `superpowers` to help me build this feature." -> Start here, then route to brainstorming, planning, execution, TDD, and review as needed.
- "Use `superpowers-debugging` to find the root cause." -> Debugging skill takes priority directly.
- "Review this change for bugs." -> Prefer `superpowers-code-review` even if `superpowers` is not named.

In short:

- Explicit `superpowers` -> start with this skill.
- Explicit sub-skill -> use the named sub-skill.
- No named skill -> choose the most relevant sub-skill for the task.

## When To Invoke

Invoke this skill when:

- The user wants to build a new feature.
- The task needs design clarification before coding.
- The change is large enough to benefit from a written plan.
- The work should be split into small verifiable steps.
- The user asks for a structured implementation workflow.
- The task involves debugging, refactoring, or cross-file changes.

Do not invoke this skill for trivial one-line edits or purely informational questions.

## Core Principles

1. Spec before implementation.
2. Prefer small, testable increments.
3. Verify every meaningful change.
4. Keep solutions minimal and avoid speculative abstractions.
5. Ask for confirmation at decision points that change scope or behavior.

## Workflow

### 1. Clarify The Goal

Before editing code:

- Invoke `superpowers-brainstorming` to:
  - Restate the user's goal.
  - Ask targeted questions only when requirements are ambiguous.
  - Identify constraints, risks, and acceptance criteria.
  - Summarize the intended behavior in a short spec if the task is non-trivial.

### 2. Propose A Concrete Plan

When the design is clear:

- Invoke `superpowers-planning` to:
  - Break work into small tasks that can be completed and verified independently.
  - Mention the likely files to touch.
  - State how each step will be validated.
  - Prefer plans that a junior engineer could follow without guessing.

Plan items should be specific, such as:

- Add API route in `server.js`.
- Update page component in `src/pages/ReviewPage.jsx`.
- Add targeted verification or test coverage.

### 3. Execute In Small Steps

During implementation:

- Invoke `superpowers-execution` to:
  - Change as little as necessary to satisfy the current step.
  - Avoid mixing unrelated refactors with feature work.
  - Keep the user informed with short progress updates.
  - Re-check nearby code before editing if the file may have changed.

### 4. Verify

After each meaningful step:

- Use `superpowers-tdd` when tests are valuable for the change.
- Run the most relevant verification available.
- Prefer focused checks before broad test suites.
- Use linting, diagnostics, or targeted commands when appropriate.
- If verification fails, fix the issue before moving on.

### 5. Review Before Hand-off

Before completion:

- Invoke `superpowers-code-review` to:
  - Confirm the result matches the agreed plan.
  - Note trade-offs, residual risks, and missing coverage.
  - Suggest next actions only if they are useful and concrete.

## Testing Guidance

Prefer test-first or test-near development when:

- The change affects business logic.
- The bug is reproducible.
- The feature can regress silently.
- The repository already has nearby test patterns.

Skip adding tests when:

- The change is trivial and low-risk.
- The project has no practical test harness for the specific path.
- Manual verification is sufficient and clearly described.

## Debugging Guidance

For debugging tasks:

1. Invoke `superpowers-debugging`.
2. Reproduce the issue.
3. Form a concrete hypothesis.
4. Gather evidence from logs, traces, diagnostics, or minimal instrumentation.
5. Fix the root cause, not only the symptom.
6. Re-run the reproduction steps to confirm the fix.

## Output Style

When using this skill:

- Be concise and structured.
- Lead with findings or outcome, then supporting details.
- Reference exact files and symbols when relevant.
- Keep plans actionable and verification explicit.

## Example Triggers

- "Help me plan this feature."
- "Refactor this flow safely."
- "Fix this bug step by step."
- "Make a small implementation plan before coding."
- "Work like a structured spec-first coding agent."
