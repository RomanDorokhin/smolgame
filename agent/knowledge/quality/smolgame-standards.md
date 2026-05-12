# SmolGame: 35-Point Ultimate Quality Standards

The gold standard for mobile-first, Telegram-integrated mini-games.

### 1-10: Technical Core
1. `touch-action: none` on canvas.
2. `localStorage` inside `try/catch`.
3. `requestAnimationFrame` for the loop.
4. `dt` (delta time) usage.
5. Responsive `resize()` logic.
6. `location.reload()` is BANNED.
7. Absolute paths (e.g., `/img/`) are BANNED (use relative).
8. `window.parent` / `top` access is BANNED.
9. No external libraries (Phaser/Three.js) unless requested.
10. Single-file HTML/JS structure.

### 11-20: Mobile UX
11. Portrait mode focus (9:16).
12. Thumb-zone optimization for controls.
13. Minimum tap target size (44x44px).
14. Virtual joystick for movement.
15. Swipe detection for navigation/actions.
16. Haptic feedback simulation (Screen Shake).
17. No cursor-dependent hover states.
18. Prevent accidental double-tap zoom (`user-scalable=no`).
19. Fast boot (<2s to interactive).
20. Offline-ready (minimal external assets).

### 21-30: Juice & Visuals
21. 3+ layers of parallax.
22. Particle system for explosions/feedback.
23. Screen shake on impact.
24. Neon/Glow (`shadowBlur`) for key elements.
25. Smooth interpolation (`lerp`) for movement.
26. Vignette and Scanline overlays.
27. Color palette harmony (use curated hex codes).
28. Dynamic background (colors change with progress).
29. Trail effects for fast objects.
30. Squash & Stretch animations.

### 31-35: Game Design & Meta
31. FSM: INTRO -> PLAY -> OVER screens.
32. Procedural audio (Web Audio API).
33. Dynamic difficulty scaling.
34. HUD on canvas (not DOM).
35. Demo Mode: Self-playing loop on Intro screen.
