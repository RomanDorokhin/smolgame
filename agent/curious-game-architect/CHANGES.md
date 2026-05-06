# Curious Game Architect — Changes & Completion Notes

## Summary

This document describes all changes made to complete the **Curious Game Architect** project from its prototype state to a fully working application.

---

## Files Modified

### `server/routers.ts` — Major additions

**New `game.chat` tRPC procedure:**
- Accepts a full conversation history (`messages` array with `role` + `content`)
- Calls the LLM via `invokeLLM` with retry logic (3 attempts, exponential backoff)
- Returns the AI response text for the interview chat

**Enhanced `game.generateGame` procedure:**
- Added `withRetry` helper (up to 3 attempts with exponential backoff)
- Added `invokeLLMWithTimeout` wrapper (120 second timeout for game generation)
- Strips markdown code fences if LLM wraps output in ` ```html ` blocks
- **Post-processing fix:** Automatically injects `initGame()` call into `DOMContentLoaded` if the LLM defines `initGame()` but forgets to call it — a common LLM mistake

---

### `shared/interviewFlow.ts` — Prompt optimization

**`buildGamePrompt()` rewritten:**
- Cleaner, more concise format
- All original technical requirements preserved
- Added explicit requirement: `Auto-start: call initGame() inside DOMContentLoaded`
- Added requirement for Russian language support
- Added cache-busting requirement
- Strings aligned with test expectations (`static HTML/CSS/JS`, `44x44px`, `16px`, etc.)

---

### `client/src/hooks/useGameInterview.ts` — Complete rewrite

**Real LLM chat integration:**
- `sendMessage()` now calls the `game.chat` tRPC procedure with full conversation history
- System prompt sets the AI persona as an enthusiastic game design interviewer
- Maintains full conversation history for context-aware follow-up questions
- Extracts `GameSpec` fields from AI responses using keyword matching

**Separate loading states:**
- `isLoading` — AI is responding to a chat message
- `isGenerating` — Game HTML is being generated

**Interview completion detection:**
- Checks `isGameSpecComplete()` after each answer
- Sends a final "ready" summary message when all 7 fields are collected

**`generateGame()` function:**
- Calls `game.generateGame` tRPC procedure with the collected `GameSpec`
- Returns `{ htmlCode, prompt }` for the preview iframe

**`resetInterview()` function:**
- Clears all state for a fresh start

---

### `client/src/pages/Home.tsx` — Complete UI rewrite

**Layout:**
- Split-panel layout: chat on the left, game preview on the right (when game is ready)
- Responsive: full-width chat until game is generated

**Header:**
- Game Architect title with `Gamepad2` icon
- Field counter: `X/7 fields collected`
- Progress bar with percentage
- "✓ Ready to generate!" indicator when complete
- Download button (appears when game is ready)
- "Start Over" button (always visible)
- "Generate Game" retry button (appears on error)

**Chat messages:**
- User messages: right-aligned, blue bubble with user avatar
- Assistant messages: left-aligned, muted bubble with sparkle avatar
- Timestamps on every message
- Markdown rendering via `Streamdown` component for AI responses
- Animated typing indicator (3 bouncing dots) while AI is responding
- "Generating your game..." loading message with spinner

**Game Preview panel:**
- Appears on the right when game HTML is ready
- iframe with `allow-scripts allow-same-origin` sandbox
- "Download HTML" button
- Fullscreen toggle button

**Input area:**
- Disabled during loading/generation
- Placeholder text changes based on state
- "Answer all 7 questions to generate your game" hint

**Auto-generation:**
- When all 7 fields are collected, game generation starts automatically after 1.2s delay
- Error state shows retry button

---

### `vitest.config.ts` — Test configuration fix

- Added `include` pattern to only run server/shared tests (not client tests that import CSS)
- Added `css.postcss.plugins: []` to prevent PostCSS errors in test environment

---

## Architecture

```
User answers questions
        ↓
useGameInterview hook
        ↓
game.chat tRPC (LLM)  ←→  AI interview conversation
        ↓
GameSpec collected (7 fields)
        ↓
game.generateGame tRPC (LLM)  →  HTML5 game code
        ↓
iframe preview + download
```

## Running the Application

```bash
cd curious-game-architect
cp .env.example .env  # Add your API keys
pnpm install
pnpm dev              # Development server on :3000
```

Required environment variables:
- `BUILT_IN_FORGE_API_URL` — LLM API base URL
- `BUILT_IN_FORGE_API_KEY` — LLM API key
- `JWT_SECRET` — Any secret string

## Tests

```bash
pnpm test   # 19 tests, all passing
pnpm check  # TypeScript — no errors
```
