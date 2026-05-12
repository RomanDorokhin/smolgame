# Skill: Prompt Self-Check

Ensure 100% alignment with user intent before generation.

## 1. Intent Verification
- Did the user ask for a *new* game or a *modification*?
- What is the *genre*? (Runner, Puzzle, etc.)
- What is the *vibe*? (Neon, Retro, Minimalist).

## 2. Constraint Check
- Did the user specify a control scheme (Joystick vs Swipe)?
- Are there specific gameplay rules mentioned (e.g., "three lives", "gravity changes")?

## 3. Pre-Flight Correction
- If the user asks for "Keyboard" controls -> Mentally translate to "Touch/Joystick".
- If the user asks for "External Assets" -> Translate to "Procedural Generation/Canvas drawing".
- If the request is vague -> Choose the "Arcade-Canvas" template as the safest default.
