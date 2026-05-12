# Skill: Telegram WebView Integration

Solving common bugs and constraints in the Telegram environment.

## 1. Scroll Prevention
The biggest issue in Telegram is the "pull-to-refresh" or "rubber-banding" of the WebView.
- **Fix:** CSS `html, body { overflow: hidden; height: 100%; position: fixed; }`
- **Fix:** Canvas `touch-action: none`.

## 2. Canvas Compatibility
- **roundRect Polyfill:** Some older Android WebViews in Telegram don't support `ctx.roundRect`.
```javascript
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    this.beginPath();
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
    return this;
  };
}
```

## 3. Keyboard Handling
- Avoid `window.innerHeight` changes when the keyboard pops up.
- Use a fixed aspect ratio or lock the viewport.

## 4. Audio in iFrame
- Telegram WebViews often block audio until a explicit "Play" button is tapped inside the iframe.
- Standard: Start the game with a "START" button that also calls `audioCtx.resume()`.

## 5. Safe Storage
- Telegram on iOS can throw `SecurityError` when accessing `localStorage` in private mode or under certain iframe policies.
- **Fix:** Always wrap in `try/catch`.
