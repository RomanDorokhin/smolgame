# Genre: Platformer

Gravity, momentum, and precise collision.

## 1. Physics
- `gravity = 0.5`, `friction = 0.8`.
- Jump: Apply upward velocity, check `onGround` flag.
- Coyote Time: Allow jumping for a few frames after leaving a platform.
- Jump Buffering: Queue a jump if pressed just before landing.

## 2. Collision
- Resolve Y-axis first (falling on platforms).
- Resolve X-axis second (walking into walls).
- Use `Math.sign(velocity)` to determine push direction.

## 3. Juicy Feedback
- **Stretch & Squash:** Scale the character based on vertical velocity.
- **Dust:** Spawn particles at the feet when landing or jumping.
- **Screen Shake:** Shake on high-velocity impact.
