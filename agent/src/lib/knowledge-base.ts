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
      text: `SKELETON GLOBALS: W, H, ctx, scale (DPR), score, hi, shake, cam, joy, swipe, glow(c,b), nglow(), sfx(f,t,ty), Part, safeStorage.`,
      tags: ['api', 'reference']
    },
    'anti-patterns': {
      text: `CRITICAL: NO getElementById, NO addEventListener (use onTouch), NO manual loop, NO joy overrides.`,
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

export type KnowledgeCategory = keyof typeof KNOWLEDGE_BASE;

/**
 * Returns a subset of the knowledge base based on relevant tags or categories.
 * Prevents prompt bloat by only including what's necessary.
 */
export function getRelevantKnowledge(tags: string[] = []): string {
  let prompt = "--- TECHNICAL KNOWLEDGE BASE (CONTEXTUAL) ---\n";
  const used = new Set<string>();

  const add = (cat: string, id: string, item: { text: string, tags: string[] }) => {
    const key = `${cat}:${id}`;
    if (used.has(key)) return;
    prompt += `[${cat.toUpperCase()}] ${id}: ${item.text}\n`;
    used.has(key);
  };

  // Always include Core API and Anti-patterns
  Object.entries(KNOWLEDGE_BASE.code).forEach(([id, item]) => add('code', id, item));
  
  // Search for matching tags
  for (const [cat, items] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [id, item] of Object.entries(items as any)) {
      const it = item as { text: string, tags: string[] };
      if (tags.some(t => it.tags.includes(t.toLowerCase()))) {
        add(cat, id, it);
      }
    }
  }

  // Fallback to basic Core if prompt is too small
  if (used.size < 5) {
     Object.entries(KNOWLEDGE_BASE.core).forEach(([id, item]) => add('core', id, item as any));
  }

  return prompt;
}

export const getFullKnowledgePrompt = (genre?: string) => {
  return getRelevantKnowledge(genre ? [genre, 'plan', 'juice', 'mobile'] : ['plan', 'juice', 'mobile']);
};
