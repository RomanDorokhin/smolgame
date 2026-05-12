# Skill: HTML5 Canvas Mastery

Professional canvas rendering for high-performance mobile games.

## 1. The Game Loop
- Use `requestAnimationFrame` for smooth 60fps.
- Implement `dt` (delta time) for frame-independent movement.
- **Strict rule:** Never use `setInterval` or `setTimeout` for the loop.

## 2. Rendering Layers
Organize your `draw()` function into distinct layers:
1. **Background:** Deep parallax layers, static gradients.
2. **Midground:** Game objects (player, enemies, bullets).
3. **Foreground:** Particles, screen overlays (vignette, scanlines).
4. **HUD:** Score, health, UI (rendered last).

## 3. Transformation & State
- Always use `ctx.save()` and `ctx.restore()` around object rendering.
- Use `ctx.translate(x, y)` and `ctx.rotate(a)` instead of calculating rotated vertices manually.
- **Center Pivot:** Translate to object center, rotate, then draw at `-width/2, -height/2`.

## 4. Optimization
- Avoid `ctx.shadowBlur` for many objects; use it only for the player or "glow" effects.
- Use `Math.floor()` or bitwise `~~` for coordinates to avoid sub-pixel rendering blur.
- Batch similar operations (e.g., draw all particles of the same color in one `beginPath`).

## 5. Responsive Canvas
- `W` and `H` are dynamic.
- Use a `scale` variable based on `min(W, H) / targetDimension`.
- All sizes and speeds should be multiplied by `scale`.
