# Skill: Code Debugging (Static Analysis)

Finding bugs in Canvas games without a runtime.

## 1. Context State Leaks
- Check for `ctx.save()` without a matching `ctx.restore()`. This causes cumulative translation/scaling bugs.
- Verify `ctx.beginPath()` is called before every new shape to avoid drawing one giant connected line.

## 2. Coordinate Systems
- Are objects drawn relative to `W` and `H`? (Correct: `W/2`, Incorrect: `200` if W is unknown).
- Is `scale` applied to sizes and speeds?

## 3. Loop Logic
- Check if `requestAnimationFrame(loop)` is called at the end of the loop.
- Ensure `ctx.clearRect(0, 0, W, H)` is the first thing in the loop.

## 4. Input State
- Verify that `swipe.up` is NOT true forever. It must be reset after the first read in `update()`.
- Check if `joy.active` is used to guard joystick reading logic.
