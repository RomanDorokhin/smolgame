# Skill: Performance Budget (Mobile)

Ensuring 60fps on mid-range and low-end mobile devices.

## 1. Canvas Efficiency
- Avoid large `shadowBlur` values for every object. Limit glow to 1-3 key entities.
- Don't use `ctx.clip()` in high-frequency loops; use simple bounding box logic.
- Avoid heavy `ctx.filter` (blur, contrast) if possible; use manual overlays instead.

## 2. Object Management
- Limit active particles to ~100-200.
- Pool objects (reuse dead bullets/enemies) to prevent Garbage Collection spikes.
- Cull objects that are off-screen immediately.

## 3. Math & Logic
- Use `Math.atan2` sparingly in loops; cache values if possible.
- Avoid deep object cloning or heavy array operations inside `update()`.

## 4. Testing Metric
- If the game drops below 60fps on a typical mobile browser (WebView), reduce particle counts or glow intensity first.
