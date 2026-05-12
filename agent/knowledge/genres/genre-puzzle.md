# Genre: Puzzle

Logic-heavy systems with satisfying visual resolution.

## 1. Grid Logic
- Match-3, 2048, or Pathfinding.
- Maintain a logical 2D array separate from the visual state.
- Handle "Falling" or "Moving" animations before allowing the next input.

## 2. Interaction
- Tap to select, drag to move.
- Visual highlighting of selected/valid targets.
- Undo system: Store the grid state in a stack.

## 3. Visual Polish
- Smooth interpolation (`lerp`) for object movement.
- Glowing effects on matches or successful moves.
- HUD for "Moves Left" or "Target Score".
