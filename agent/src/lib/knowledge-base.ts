export const PATTERNS = {
  physics: {
    'aabb-collision': `
function checkAABB(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}`,
    'circle-collision': `
function checkCircle(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return distance < a.r + b.r;
}`
  },
  juice: {
    'screen-shake': `
function applyShake() {
  shake = 10;
  cam.x += Math.random() * shake - shake/2;
  cam.y += Math.random() * shake - shake/2;
}`,
    'particle-burst': `
function burst(x, y, color) {
  for(let i=0; i<15; i++) {
    state.entities.push(new Part(x, y, color, Math.random()*Math.PI*2, Math.random()*5));
  }
}`
  }
};

export const KNOWLEDGE_BASE = {
  planning: {
    'task-decomposition': {
      text: `Break complex prompts into: 1. Skeleton (FSM, Canvas), 2. Logic (update/draw), 3. Mobile (touch/input), 4. Juice (particles, shake), 5. Validation.`,
      tags: ['plan', 'architecture']
    },
    'self-review': {
      text: `Checklist: localStorage try/catch, touch-action:none, no location.reload, swipe reset, screen shake on impact, 9:16 portrait.`,
      tags: ['qa', 'mobile']
    }
  },
  core: {
    'html5-canvas': {
      text: `Use requestAnimationFrame, delta time (dt), layers (BG, Mid, FG, HUD), and ctx.save/restore. floor() coords for performance.`,
      tags: ['render', 'canvas']
    },
    'game-architecture': {
      text: `FSM states: MENU, PLAYING, GAMEOVER. Use reset() instead of reload(). Keep update() and draw() separate.`,
      tags: ['logic', 'fsm']
    },
    'collision-detection': {
      text: `AABB for boxes, Distance for circles. Spatial grid for >50 objects. Resolve Y then X for platforms.`,
      tags: ['physics', 'math']
    },
    'input-handling': {
      text: `Pointer events, virtual joystick (normalized -1 to 1), swipe detection (dist > 50px). Reset swipe flags after use.`,
      tags: ['input', 'mobile']
    },
    'audio': {
      text: `Web Audio API. Unlock on first tap. Oscillator SFX: Jump (sine sweep), Boom (noise), Beep (triangle).`,
      tags: ['sfx', 'audio']
    }
  },
  genres: {
    'snake': { text: `Grid-based logic, direction queueing, body segment array, particle pop on eat.`, tags: ['snake'] },
    'platformer': { text: `Gravity (0.5), Friction (0.8), Coyote Time, Jump Buffering, Resolve Y then X.`, tags: ['platformer'] },
    'puzzle': { text: `Grid array vs Visual lerp, state-based input locking during animations.`, tags: ['puzzle'] },
    'shooter': { text: `Bullet pooling, auto-culling offscreen, sine/spread patterns, impact flash.`, tags: ['shooter'] },
    'runner': { text: `Parallax (3-5 layers), infinite floor swapping, increasing scrollSpeed.`, tags: ['runner'] },
    'tower-defense': { text: `Waypoint pathing, tower range visualization, closest-to-exit targeting.`, tags: ['td'] }
  },
  code: {
    'api-reference': {
      text: `GLOBALS (DO NOT REDEFINE): 
      - smolState: Current game state ('start', 'play', 'over'). 
      - score: Current numeric score.
      - shake: Set to > 0 for screen shake (e.g. shake = 10).
      - W, H: Canvas width/height.
      - ctx: 2D Context.
      - cam: Camera {x, y, zoom}.
      - joy: Joystick {x, y}.
      - swipe: Swipe flags {up, down, left, right}.
      - Part: Particle class.`,
      tags: ['api', 'reference']
    },
    'state-management': {
      text: `STRICT: Use 'smolState' for flow. 'smolStartGame()' sets it to 'play'. 'smolTriggerGameOver()' sets it to 'over'. NEVER define 'let currentState'.`,
      tags: ['logic', 'safety']
    },
    'anti-patterns': {
      text: `CRITICAL: NO getElementById, NO addEventListener, NO 'let currentState', NO 'let score'. Use existing globals.`,
      tags: ['safety', 'errors']
    }
  },
  quality: {
    'juice-standards': {
      text: `JUICE (8-10/10): Screen Shake on impact, Neon Glow for active items, Particle bursts on death/collect, Parallax backgrounds, Procedural SFX.`,
      tags: ['juice', 'polish']
    },
    'mobile-ux': {
      text: `Thumb-zone controls, min 44px tap targets, no :hover dependency, CSS fixed position scroll fix.`,
      tags: ['mobile', 'ux']
    }
  }
};

/**
 * Returns a subset of the knowledge base based on relevant tags or categories.
 * Uses keyword scoring to prevent prompt bloat.
 */
export function getRelevantKnowledge(tags: string[] = [], contextText: string = ""): string {
  let prompt = "--- TECHNICAL KNOWLEDGE BASE & PATTERNS ---\n";
  const scoredItems: Array<{ cat: string, id: string, text: string, score: number, isPattern?: boolean }> = [];

  const contextKeywords = contextText.toLowerCase().split(/\W+/);
  const targetTags = tags.map(t => t.toLowerCase());

  // Search in Knowledge Base
  for (const [cat, items] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [id, item] of Object.entries(items as any)) {
      const it = item as { text: string, tags: string[] };
      let score = 0;
      if (targetTags.some(t => it.tags.includes(t))) score += 20;
      contextKeywords.forEach(kw => {
        if (kw.length > 3 && it.text.toLowerCase().includes(kw)) score += 5;
      });
      if (score > 0 || cat === 'code') {
        scoredItems.push({ cat, id, text: it.text, score: cat === 'code' ? 100 : score });
      }
    }
  }

  // Search in Patterns
  for (const [cat, items] of Object.entries(PATTERNS)) {
    for (const [id, code] of Object.entries(items as any)) {
      let score = 0;
      if (contextKeywords.some(kw => id.includes(kw) || cat.includes(kw))) score += 30;
      if (score > 0) {
        scoredItems.push({ cat: `PATTERN:${cat}`, id, text: code as string, score, isPattern: true });
      }
    }
  }

  // Sort and take top 12
  const topItems = scoredItems.sort((a, b) => b.score - a.score).slice(0, 12);

  topItems.forEach(it => {
    if (it.isPattern) {
      prompt += `[CODE_${it.cat}] ${it.id}:\n${it.text}\n`;
    } else {
      prompt += `[${it.cat.toUpperCase()}] ${it.id}: ${it.text}\n`;
    }
  });

  return prompt;
}

export const getFullKnowledgePrompt = (genre?: string, context?: string) => {
  return getRelevantKnowledge(genre ? [genre, 'plan', 'juice', 'mobile'] : ['plan', 'juice', 'mobile'], context);
};
