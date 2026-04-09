---
name: "superpowers-debugging"
description: "Uses root-cause-first debugging for bugs and failures. Invoke when behavior is broken, tests fail, builds fail, or the cause is not yet understood."
---

# Superpowers Debugging

Use this skill for systematic debugging. Never jump straight to fixes.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-debugging`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here when the task is about bug investigation, failure analysis, or root-cause discovery.
- If the user names no skill, this skill may still be selected when the task is clearly about broken behavior, failing tests, or unexpected runtime results.

## When To Invoke

Invoke when:

- A bug is reported.
- A test fails unexpectedly.
- A build or integration breaks.
- Performance or runtime behavior is wrong.
- Previous guess-based fixes did not work.

## Iron Law

No fix without root cause investigation first.

If the root cause is not understood, continue investigating instead of patching symptoms.

## Four Phases

### 1. Investigate

- Read the error message and stack trace carefully.
- Reproduce the issue consistently.
- Check recent relevant changes.
- Gather evidence at component boundaries.
- Trace bad data or state back to its source.

### 2. Analyze Patterns

- Find nearby working examples.
- Compare broken and working paths carefully.
- List concrete differences.
- Identify required dependencies, config, and assumptions.

### 3. Form And Test A Hypothesis

- State one specific hypothesis.
- Test with the smallest possible change or instrumentation.
- Change one variable at a time.
- If the hypothesis fails, form a new one instead of stacking fixes.

### 4. Implement And Verify

- Create the smallest reliable reproduction or failing test.
- Fix the root cause only.
- Re-run the reproduction and relevant checks.
- Stop and reassess if multiple attempted fixes fail.

## Rules

- Prefer evidence over intuition.
- Do not bundle cleanup refactors into the fix.
- Say what is known, what is unknown, and what evidence supports the next step.

## Example Triggers

- "Debug this failing API."
- "Why does this test break intermittently?"
- "The build started failing after a config change."
