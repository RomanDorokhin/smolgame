# Skill: Task Decomposition (Game Dev)

Break complex "Make a game" prompts into manageable logical chunks.

## 1. Phase: Foundation (Skeleton)
- Define the Game State Machine (Intro, Play, Over).
- Initialize Canvas, W, H, and Resize logic.
- Set up core variables (Player, Entities array, Score).

## 2. Phase: Core Loop (Logic)
- Implement `update()`: Movement, basic collision, gravity.
- Implement `draw()`: Render basic shapes for all entities.
- Verify game-over condition.

## 3. Phase: Mobile Integration (UX)
- Configure `joy.enabled` or `swipe` listeners.
- Map touch events to player actions.
- Ensure `touch-action: none` is present.

## 4. Phase: The "Juice" (Polish)
- Add Parallax backgrounds.
- Add Particle system (Explosions, Trails).
- Add Screen Shake and Glow effects.
- Implement Web Audio API sounds.

## 5. Phase: Validation
- Run final Self-Review against the 35-point checklist.
