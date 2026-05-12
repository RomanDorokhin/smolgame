# SmolGame AI Agent — System Guide

This document describes the AI agent architecture, prompt pipeline, and quality standards for SmolGame game generation.

## Pipeline Overview

The agent operates in three sequential phases for every new game request:

| Phase | Role | Prompt | Output |
|-------|------|--------|--------|
| 1 | Interviewer | `INTERVIEWER_PROMPT` | `<plan>` block with template choice |
| 2 | Engineer | `ENGINEER_PROMPT` | `<game_spec>` with full game code |
| 3 | QA Validator | `QA_PROMPT` | Fixed code or `<status>PASSED</status>` |

For modification requests (when previous code exists), Phase 1 and 3 are preserved; Phase 2 uses `AIDER_EDITOR_PROMPT`.

## Knowledge Base (Skills)

The agent uses a multi-layered knowledge base in `agent/knowledge/` to ensure professional, high-performance output:

| Category | Skills / Files |
|----------|----------------|
| **Planning** | `task-decomposition.md`, `self-review.md`, `prompt-self-check.md` |
| **Core Logic** | `html5-canvas.md`, `game-architecture.md`, `collision-detection.md`, `input-handling.md`, `audio.md` |
| **Genres** | `genre-snake.md`, `genre-platformer.md`, `genre-puzzle.md`, `genre-shooter.md`, `genre-runner.md`, `genre-tower-defense.md` |
| **Code Quality** | `code-debugging.md`, `code-refactoring.md`, `single-file-constraints.md`, `performance-budget.md` |
| **Standards** | `qa-checklist.md` (35 pts), `mobile-first.md`, `telegram-webview.md` |
| **Process** | `report-format.md`, `error-escalation.md` |

## Quality Standards

All generated games MUST comply with the **35-Point Checklist** in `knowledge/quality/qa-checklist.md`.

### Professional Workflow
1. **Plan:** Decompose the request (`task-decomposition.md`).
2. **Draft:** Implement using core and genre-specific skills.
3. **Refine:** Apply mobile-first principles and performance budgets.
4. **Review:** Run the `self-review.md` protocol.
5. **Report:** Provide output in the standard `report-format.md`.

## File Structure

```
agent/
├── knowledge/
│   ├── planning/      # Meta-cognition and task breakdown
│   ├── core/          # Fundamental engine logic
│   ├── genres/        # Genre-specific rules
│   ├── code/          # Best practices and refactoring
│   ├── quality/       # QA and mobile standards
│   └── communication/ # Reporting and escalation
├── src/hooks/
│   ├── useGameAgent.ts
│   └── agent_prompts.ts
└── AGENTS.md
```


## Integration Instructions

The `ENGINEER_PROMPT` in `agent_prompts.ts` should be configured to "Recall skills from /agent/knowledge/" to ensure the AI applies these patterns during generation.
