# Skill: Game Architecture (Single File)

Structure for maintaining complexity within a single HTML file.

## 1. Finite State Machine (FSM)
Use a global `state` variable to control logic and rendering:
- `MENU`: Intro screen, high score, title.
- `PLAYING`: Active game loop.
- `GAMEOVER`: Result screen, restart button.
- `PAUSED`: Static overlay, loop continues but `update()` is skipped.

## 2. Modular Structure
Even in one file, keep logic separate:
- **Global Config:** Constants, colors, settings.
- **State Variables:** Player, enemies, score, particles.
- **System Functions:** `resize()`, `spawnEnemy()`, `shakeScreen()`.
- **Core Loop:** `init()`, `update()`, `draw()`.

## 3. Object-Oriented Entities
Use Classes or Constructor functions for groups of objects (Bullets, Enemies, Particles):
```javascript
class Entity {
  constructor(x, y) { this.x = x; this.y = y; this.dead = false; }
  update(dt) { /* logic */ }
  draw() { /* render */ }
}
```

## 4. Reset Logic
- Do NOT use `location.reload()`.
- Implement a `reset()` function that clears arrays, resets player position, and sets `score = 0`.
- All spawning logic must be idempotent.
