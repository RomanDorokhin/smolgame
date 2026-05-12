# Skill: Mobile-First Design

Philosophy and implementation for vertical mobile screens.

## 1. Portrait by Default
- Assume a 9:16 aspect ratio.
- Use `scale` to fit the game logic into the viewport regardless of the phone model.

## 2. Touch Anatomy
- **The Thumb Zone:** Place primary actions (jump, shoot, move) in the bottom third of the screen.
- **Visual Feedback:** Taps must produce a visual response (a ripple, a sound, or an animation) so the user knows the input was registered.

## 3. Viewport Meta
- Mandatory tag: `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">`.
- CSS: `touch-action: none` and `user-select: none`.

## 4. No Hover
- Do not use `:hover` styles or rely on mouse movement without clicking.
- Interactive elements should look "tappable" (shadows, bright colors, large sizes).
