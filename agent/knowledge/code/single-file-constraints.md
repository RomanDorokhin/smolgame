# Skill: Single-File Constraints

Rules for zero-dependency, single-file HTML games.

## 1. No Imports
- No `import` or `require`.
- No external JS files (scripts must be inlined in `<script>` tags).

## 2. No External Assets
- No `img/sprite.png` or `audio/jump.mp3`.
- Use **Procedural Generation**: Draw shapes on canvas, use `shadowBlur` for glow.
- If assets are mandatory, use **Data URIs** (Base64) or **SVG strings** inlined in the code.

## 3. Self-Contained CSS
- All styling must be inside a `<style>` tag in the `<head>`.
- Use CSS variables for theme colors to make them easy to change.

## 4. Portability
- The resulting `.html` file must work when opened directly in a browser without a local server.
- Avoid any Web APIs that require a secure context (HTTPS) unless essential (like some Web Audio features, though they usually work in WebViews).
