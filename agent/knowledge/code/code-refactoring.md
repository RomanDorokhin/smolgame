# Skill: Code Refactoring (Iteration Safety)

Maintaining a clean single-file structure across multiple updates.

## 1. Avoid Global Soup
- Group related variables into objects (e.g., `const player = { x:0, y:0, v:0 };`).
- Use the "Modular Structure" pattern: Config -> State -> Systems -> Loop.

## 2. Idempotent Spawning
- Ensure that `init()` or `reset()` clears all arrays (`entities = []`, `particles = []`) before starting.
- Avoid duplicate event listeners by attaching them once in the global scope, not inside `init()`.

## 3. Pure Logic Separation
- Keep `draw()` as pure as possible. Move all math/position updates to `update()`.
- This makes debugging logic errors much easier as you only look at one function.

## 4. Minimal DOM
- Only use DOM for big UI screens (Intro, Game Over).
- Use Canvas for high-frequency UI like score counters or health bars.
