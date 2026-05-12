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

/**
 * Returns a subset of the knowledge base based on relevant tags or categories.
 * Uses a simple keyword scoring to prevent prompt bloat.
 */
export function getRelevantKnowledge(tags: string[] = [], contextText: string = ""): string {
  let prompt = "--- TECHNICAL KNOWLEDGE BASE (CONTEXTUAL) ---\n";
  const scoredItems: Array<{ cat: string, id: string, text: string, score: number }> = [];

  const contextKeywords = contextText.toLowerCase().split(/\W+/);
  const targetTags = tags.map(t => t.toLowerCase());

  for (const [cat, items] of Object.entries(KNOWLEDGE_BASE)) {
    for (const [id, item] of Object.entries(items as any)) {
      const it = item as { text: string, tags: string[] };
      let score = 0;
      
      // Tag match (high priority)
      if (targetTags.some(t => it.tags.includes(t))) score += 10;
      
      // Keyword match (medium priority)
      const itemText = it.text.toLowerCase();
      contextKeywords.forEach(kw => {
        if (kw.length > 3 && itemText.includes(kw)) score += 2;
      });

      if (score > 0 || cat === 'code') { // Always include code/api
        scoredItems.push({ cat, id, text: it.text, score: cat === 'code' ? 100 : score });
      }
    }
  }

  // Sort by score and take top 10
  const topItems = scoredItems.sort((a, b) => b.score - a.score).slice(0, 10);

  topItems.forEach(it => {
    prompt += `[${it.cat.toUpperCase()}] ${it.id}: ${it.text}\n`;
  });

  return prompt;
}

export const getFullKnowledgePrompt = (genre?: string, context?: string) => {
  return getRelevantKnowledge(genre ? [genre, 'plan', 'juice', 'mobile'] : ['plan', 'juice', 'mobile'], context);
};

