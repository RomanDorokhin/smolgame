# Genre: Shooter (Shmup)

Bullet management and intense screen effects.

## 1. Projectiles
- Use an array for bullets.
- Auto-culling: Remove bullets when they leave the screen.
- Pattern generation: Sine waves, spread shots, spiral patterns.

## 2. Enemy AI
- Movement patterns (Wave, Dive, Circle).
- Spawning logic: Timer-based or wave-based.

## 3. High Juice
- **Muzzle Flash:** Brief bright circle at the gun tip.
- **Impact Flash:** Flicker enemy color when hit.
- **Chain Explosions:** One death triggers nearby particle effects.
- **Slow Motion:** Briefly slow `dt` on boss kill.
