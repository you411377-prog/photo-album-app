---
name: "superpowers-brainstorming"
description: "Turns rough ideas into an approved design. Invoke before building features, changing behavior, or making any non-trivial product or UX decision."
---

# Superpowers Brainstorming

Use this skill to refine a request into a clear, approved design before implementation.

## Relationship To `superpowers`

This is a peer skill under `.trae/skills/`, not a child file under the `superpowers` directory.

Use the following routing logic:

- If the user explicitly names `superpowers-brainstorming`, use this skill directly.
- If the user explicitly names `superpowers`, that orchestration skill may route here when the task is in the design or requirement-clarification phase.
- If the user names no skill, this skill may still be selected when the task is clearly about brainstorming, design, or spec refinement.

## When To Invoke

Invoke when:

- The user wants a new feature or workflow.
- The task changes behavior, UX, APIs, or architecture.
- Requirements are incomplete or ambiguous.
- The solution space has multiple valid approaches.

Do not invoke for trivial typo fixes or purely mechanical edits.

## Required Process

1. Explore the current project context first.
2. Ask clarifying questions one at a time when needed.
3. Propose 2-3 viable approaches with trade-offs.
4. Recommend one approach and explain why.
5. Present a concise design/spec and ask for approval.
6. Do not start implementation before approval.
7. After approval, hand off to `superpowers-planning`.

## Rules

- Do not write code during brainstorming.
- Keep questions focused on purpose, constraints, and success criteria.
- If the request is too broad, decompose it into smaller sub-projects.
- Scale the design to the task size: short for simple work, structured for larger work.

## Design Output Checklist

Include:

- Goal
- Scope and non-goals
- User-visible behavior
- Data flow or architecture notes
- Constraints and risks
- Acceptance criteria

## Example Triggers

- "Help me think through this feature."
- "Let's design this before coding."
- "What are the best approaches for this change?"
- "Refine this idea into a spec."
