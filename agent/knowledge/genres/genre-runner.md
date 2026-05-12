# Genre: Runner

Endless scrolling and rhythmic obstacle dodging.

## 1. Scrolling
- Parallax layers: 3-5 layers moving at different speeds.
- Infinite floor: Reuse two floor segments, swapping them as they leave the screen.

## 2. Obstacles
- Pool obstacles to avoid frequent GC.
- Vary obstacle heights to force both jumping and ducking.

## 3. Progression
- Increase `scrollSpeed` over time.
- Reward systems: Multiplier for near-misses, coin collecting.

## 4. Juice
- **Motion Blur:** Simple horizontal lines behind the player.
- **Wind Particles:** Fast-moving white lines in the background.
- **Impact Flash:** Red vignette on hit.
