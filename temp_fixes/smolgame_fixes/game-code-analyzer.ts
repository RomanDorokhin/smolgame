export interface AnalysisIssue {
  severity: 'critical' | 'warning' | 'info' | 'juice';
  code: string;
  message: string;
  fix: string;
}

export interface AnalysisResult {
  passed: boolean;
  score: number; 
  juiceScore: number; // 0-100 scale for polish
  issues: AnalysisIssue[];
}

const RULES: Array<{
  code: string;
  severity: 'critical' | 'warning' | 'info' | 'juice';
  message: string;
  fix: string;
  test: (code: string) => boolean;
}> = [
  // ── CRITICAL ──────────────────────────────────────────────────────────
  {
    code: 'TOUCH_ACTION_MISSING',
    severity: 'critical',
    message: 'canvas missing touch-action: none',
    fix: 'Add CSS: canvas { touch-action: none; }',
    test: (c) => !c.includes('touch-action'),
  },
  {
    code: 'UNSAFE_LOCALSTORAGE',
    severity: 'critical',
    message: 'localStorage used without try/catch',
    fix: 'Wrap all localStorage calls in try/catch',
    test: (c) => c.includes('localStorage') && !(c.includes('try {') || c.includes('safeStorage')),
  },
  
  // ── JUICE (Quality & Polish) ──────────────────────────────────────────
  {
    code: 'NO_PARALLAX',
    severity: 'juice',
    message: 'No parallax layers detected — background feels flat',
    fix: 'Add at least 2 layers of background objects moving at different speeds',
    test: (c) => !c.includes('parallax') && !(/layer[s]?/.test(c) && c.includes('Math.random')),
  },
  {
    code: 'NO_SHAKE',
    severity: 'juice',
    message: 'No screen shake — game lacks impact feedback',
    fix: 'Add a shake variable and apply ctx.translate() in the draw loop on impact',
    test: (c) => !c.includes('shake') && !c.includes('translate'),
  },
  {
    code: 'NO_PARTICLES',
    severity: 'juice',
    message: 'No particle systems — death or collection feels empty',
    fix: 'Create a simple particle array to spawn bursts of color on events',
    test: (c) => !c.includes('particle') && !c.includes('burst'),
  },
  {
    code: 'NO_AUDIO',
    severity: 'juice',
    message: 'No AudioContext — game is silent',
    fix: 'Use Web Audio API oscillators for simple, procedural SFX',
    test: (c) => !c.includes('AudioContext'),
  },
  {
    code: 'NO_GLOW',
    severity: 'juice',
    message: 'No neon/glow effects — visual style is basic',
    fix: 'Use ctx.shadowBlur and ctx.shadowColor for neon effects',
    test: (c) => !c.includes('shadowBlur'),
  },
  {
    code: 'NO_TRAIL',
    severity: 'juice',
    message: 'No motion trails — movement lacks fluidity',
    fix: 'Store previous player positions and draw them with decreasing opacity',
    test: (c) => !c.includes('trail'),
  }
];

export function analyzeGameCode(code: string): AnalysisResult {
  const issues: AnalysisIssue[] = [];
  for (const rule of RULES) {
    if (rule.test(code)) {
      issues.push({ severity: rule.severity, code: rule.code, message: rule.message, fix: rule.fix });
    }
  }

  const criticals = issues.filter(i => i.severity === 'critical').length;
  const juices = issues.filter(i => i.severity === 'juice').length;

  const score = Math.max(0, 100 - criticals * 30);
  const juiceScore = Math.max(0, 100 - juices * 15);

  return {
    passed: criticals === 0,
    score,
    juiceScore,
    issues,
  };
}
