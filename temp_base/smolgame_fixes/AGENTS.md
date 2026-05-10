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

## Game Templates

When the Interviewer selects a template in the `<plan>` block, the Engineer uses the corresponding skeleton from `skeletons/` as a structural reference:

| Template ID | File | Best For |
|-------------|------|----------|
| `arcade-canvas` | `skeletons/arcade-canvas.html` | Runners, shooters, dodge games |
| `physics-puzzle` | `skeletons/physics-puzzle.html` | Ball puzzles, stacking, Angry Birds-style |
| `narrative-mystery` | `skeletons/narrative-mystery.html` | Text adventures, visual novels, escape rooms |

## Quality Standards

All generated games MUST comply with the rules defined in `GAME_DESIGN_CHECKLIST.md`. The `game-code-analyzer.ts` module performs automated static analysis before the game is shown to the user.

### Critical Rules (auto-rejected if violated)

1. **`touch-action: none`** on the canvas element — prevents Telegram feed scroll during gameplay.
2. **Safe localStorage** — all storage access wrapped in `try/catch` to prevent `SecurityError` in Telegram WebView.
3. **Complete game loop** — START screen → PLAYING state → GAME OVER screen → `restart()` without `location.reload()`.
4. **No absolute paths** — breaks GitHub Pages deployment.
5. **No iframe escape** — `top.location` and `window.parent.location` are forbidden.

## File Structure

```
smolgame_fixes/
├── useGameAgent.ts          ← Drop-in replacement for agent/src/hooks/useGameAgent.ts
├── agent_prompts.ts         ← Exported prompt constants (optional separate import)
├── game-code-analyzer.ts    ← Static analysis utility
├── AGENTS.md                ← This file (replaces root AGENTS.md)
├── GAME_DESIGN_CHECKLIST.md ← Quality checklist referenced by prompts
└── skeletons/
    ├── arcade-canvas.html   ← Arcade game template
    ├── physics-puzzle.html  ← Physics puzzle template
    └── narrative-mystery.html ← Narrative/text game template
```

## Integration Instructions

1. Copy `useGameAgent.ts` → `agent/src/hooks/useGameAgent.ts` (replaces existing file).
2. Copy `game-code-analyzer.ts` → `agent/src/lib/game-code-analyzer.ts`.
3. Copy `GAME_DESIGN_CHECKLIST.md` → project root (same level as `AGENTS.md`).
4. Copy `skeletons/` directory → `agent/src/skeletons/` or `docs/skeletons/`.
5. Copy `AGENTS.md` → project root (replaces existing `AGENTS.md`).
