# Skill: Self-Review Protocol

Mandatory checklist for the agent to run before submitting code.

## 1. Safety Check
- [ ] Is `localStorage` wrapped in `try/catch`?
- [ ] Is `touch-action: none` on the canvas?
- [ ] Are there any `location.reload()` calls? (Must be removed).

## 2. Logic Check
- [ ] Do `init`, `update`, `draw`, and `onTouch` exist?
- [ ] Are `swipe` flags reset to `false` after reading?
- [ ] Does the game restart correctly without a page refresh?

## 3. Visual "Juice" Check
- [ ] Is there at least one layer of parallax?
- [ ] Do explosions/death trigger particles?
- [ ] Does impact trigger screen shake?

## 4. Mobile Check
- [ ] Is the UI centered and readable in Portrait (9:16)?
- [ ] Are buttons large enough for thumbs?
- [ ] Is the font from Google Fonts (e.g., Orbitron)?
