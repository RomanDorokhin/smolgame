/**
 * SmolGame Knowledge Base
 * This file contains the consolidated technical skills and standards 
 * for injection into the AI Agent's prompt context.
 */

export const KNOWLEDGE_BASE = {
  planning: {
    'task-decomposition': `Break complex prompts into: 1. Skeleton (FSM, Canvas), 2. Logic (update/draw), 3. Mobile (touch/input), 4. Juice (particles, shake), 5. Validation.`,
    'self-review': `Checklist: localStorage try/catch, touch-action:none, no location.reload, swipe reset, screen shake on impact, 9:16 portrait.`,
    'prompt-self-check': `Verify intent (new vs mod), genre, controls (Joystick vs Swipe), and vibe before starting.`
  },
  core: {
    'html5-canvas': `Use requestAnimationFrame, delta time (dt), layers (BG, Mid, FG, HUD), and ctx.save/restore. floor() coords for performance.`,
    'game-architecture': `FSM states: MENU, PLAYING, GAMEOVER. Use reset() instead of reload(). Keep update() and draw() separate.`,
    'collision-detection': `AABB for boxes, Distance for circles. Spatial grid for >50 objects. Resolve Y then X for platforms.`,
    'input-handling': `Pointer events, virtual joystick (normalized -1 to 1), swipe detection (dist > 50px). Reset swipe flags after use.`,
    'audio': `Web Audio API. Unlock on first tap. Oscillator SFX: Jump (sine sweep), Boom (noise), Beep (triangle).`
  },
  genres: {
    'snake': `Grid-based logic, direction queueing, body segment array, particle pop on eat.`,
    'platformer': `Gravity (0.5), Friction (0.8), Coyote Time, Jump Buffering, Resolve Y then X.`,
    'puzzle': `Grid array vs Visual lerp, state-based input locking during animations.`,
    'shooter': `Bullet pooling, auto-culling offscreen, sine/spread patterns, impact flash.`,
    'runner': `Parallax (3-5 layers), infinite floor swapping, increasing scrollSpeed.`,
    'tower-defense': `Waypoint pathing, tower range visualization, closest-to-exit targeting.`
  },
  code: {
    'api-reference': `SKELETON GLOBALS:
- W, H: Canvas width/height (use these for all positions).
- ctx: 2D Context.
- scale: DPR multiplier (multiply all sizes/distances by this).
- score, hi: Current and high score.
- shake: Number (set shake=10 for impact).
- cam: {x, y, zoom} (change to move camera).
- joy: {x, y, active, enabled} (READ ONLY, joy handles itself).
- swipe: {up, down, left, right} (READ flags, RESET to false after).
- glow(color, blur): Apply neon effect.
- nglow(): Stop neon effect.
- sfx(freq, time, type): Play sound.
- Part: class for particles (new Part(x, y, color)).
- safeStorage: {set(k, v), get(k, d)}.`,
    'anti-patterns': `CRITICAL: 
1. NO document.getElementById('canvas'). Use 'c' or 'canvas' global.
2. NO addEventListener. Use 'onTouch(e)' function.
3. NO requestAnimationFrame loop. Engine handles it.
4. NO joy.x = ... manual overrides. Read from 'joy' object.
5. NO tutorial text. Use ONLY <plan> or <game_logic> tags.`,
    'mandatory-cot': `THINK BEFORE CODE: You must start your response by recalling the specific rules for the genre and the 35-point checklist. If you ignore 'dt' or 'shake', you have failed.`
  },
  quality: {
    'qa-checklist': `35-Point Standard: touch-action:none, safeStorage, 60fps, 9:16, Screen Shake, Neon Glow, Particles, Parallax, Procedural Audio.`,
    'mobile-first': `Portrait focus, thumb-zone controls, min 44px tap targets, no :hover dependency.`,
    'telegram-webview': `CSS fixed position scroll fix, roundRect polyfill, safeStorage try/catch.`
  },
  process: {
    'report-format': `Structure: Summary -> Changes -> Status -> Action. Tone: Pro & Concise.`,
    'error-escalation': `Stop and ask if: Ambiguity, Technical Impossibility, or 3x Loop Fail.`
  }
};

export function getFullKnowledgePrompt(): string {
  let p = "SmolGame Knowledge Base:\n\n";
  for (const [cat, skills] of Object.entries(KNOWLEDGE_BASE)) {
    p += `## ${cat.toUpperCase()}\n`;
    for (const [name, content] of Object.entries(skills)) {
      p += `- ${name}: ${content}\n`;
    }
    p += "\n";
  }
  return p;
}
