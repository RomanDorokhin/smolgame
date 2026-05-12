# Skill: Collision Detection

Efficient algorithms for real-time mobile games.

## 1. AABB (Axis-Aligned Bounding Box)
Fastest check for rectangular objects (platforms, UI, simple sprites).
```javascript
const collide = (a, b) => 
  a.x < b.x + b.w && 
  a.x + a.w > b.x && 
  a.y < b.y + b.h && 
  a.y + a.h > b.y;
```

## 2. Circle-to-Circle
Best for projectiles and round characters.
```javascript
const collide = (a, b) => {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx*dx + dy*dy) < (a.r + b.r);
};
```

## 3. Spatial Optimization
If there are >50 objects:
- **Grid-based:** Divide the screen into 50x50 cells. Only check objects in the same or adjacent cells.
- **Distance Filter:** Skip heavy collision checks if `Math.abs(a.x - b.x) > threshold`.

## 4. Resolution (Bounce/Push)
- When a collision is detected, move the object back by its velocity or to the edge of the other object.
- Apply friction or bounce coefficients to velocity.
