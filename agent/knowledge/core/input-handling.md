# Skill: Input Handling

Mobile-first interaction patterns.

## 1. Pointer Events
- Use `pointerdown`, `pointermove`, `pointerup`.
- **Mandatory:** `touch-action: none` on the canvas to prevent browser scrolling.

## 2. Virtual Joystick
- `joy.x` and `joy.y` normalized values (-1 to 1).
- Visual feedback: Base circle and handle circle.
- Deadzone: Ignore values < 0.1 to prevent drift.

## 3. Swipe Detection
- Record start position on `pointerdown`.
- Calculate delta on `pointerup`.
- Minimum distance threshold (~50px) to distinguish from taps.
- **State reset:** Swipe flags (e.g., `swipe.up`) must be set to `false` immediately after being processed in `update()`.

## 4. Multi-Touch
- Support multiple pointers for simultaneous actions (e.g., move + shoot).
- Track pointers by `e.pointerId`.

## 5. Portrait Mode
- Design for vertical orientation (9:16).
- Keep primary controls in the "Thumb Zone" (bottom 30% of the screen).
