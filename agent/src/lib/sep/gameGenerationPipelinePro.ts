import ultimateArcadeSkeleton from '../skeletons/ultimate-arcade.html?raw';
import { analyzeGameJS, extractScripts } from './ast-analyzer';
import { getFullKnowledgePrompt } from '../knowledge-base';

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  errors: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  generateFn: (messages: any[]) => Promise<string>;
  previousCode?: string;
}

// ─── GENRE → SKELETON MAPPING ────────────────────────────────
const SKELETON = {
  name: 'Ultimate Mobile',
  html: ultimateArcadeSkeleton,
};

function pickSkeleton(request: string) {
  return SKELETON;
}

import { analyzeGameCode } from './game-code-analyzer';

// ─── ADVANCED VALIDATOR ──────────────────────────
function validate(html: string): string[] {
  const report = analyzeGameCode(html);
  return report.errors;
}

// ─── AUTO-REPAIR MECHANISM ────────────────────────────────────
function autoRepair(html: string): string {
  let repaired = html;
  
  // Prevent double-repair
  if (repaired.includes('// Auto-repaired initialization')) return repaired;

  const scripts = extractScripts(repaired);
  scripts.forEach(js => {
    let cleanJs = js;
    let modified = false;

    // Fix: only replace if NOT preceded by "function "
    // We use a safe regex approach that checks the prefix
    const calls = ['init', 'loop'];
    calls.forEach(call => {
      const regex = new RegExp(`(^|[^a-zA-Z0-9_])function\\s+${call.replace('.', '\\.')}`, 'g');
      // If we find "function resizeCanvas", we skip this call in this script
      if (regex.test(cleanJs)) return;

      const callRegex = new RegExp(`([^a-zA-Z0-9_])${call.replace('.', '\\.')}\\s*\\(\\s*\\);?`, 'g');
      if (callRegex.test(cleanJs)) {
        cleanJs = cleanJs.replace(callRegex, '$1');
        modified = true;
      }
    });

    if (modified) {
      cleanJs += '\n\n// Auto-repaired initialization\nif (typeof resizeCanvas === "function") resizeCanvas();\nif (typeof Game !== "undefined" && Game.init) Game.init();\n';
      repaired = repaired.replace(js, cleanJs);
    }
  });

  return repaired;
}

// ─── MAIN PIPELINE ────────────────────────────────────────────
export async function generateGame(
  userRequest: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  const { generateFn, previousCode, onProgress } = options;
  if (typeof generateFn !== 'function') {
    throw new Error('Pipeline error: generateFn is not a function. Check your interface implementation.');
  }

  // EDIT MODE — user is tweaking an existing game
  if (previousCode) {
    onProgress?.('🛠 Applying changes...');
    try {
      const response = await generateFn([
        {
          role: 'system',
          content: `You are a Senior Game Developer. Modify the game based on user instructions.
Use SEARCH/REPLACE blocks or output the full new HTML. Code only, no explanations.
NEVER use window.alert() or confirm(). Use DOM/Canvas overlays instead.`,
        },
        { role: 'system', content: `CURRENT CODE:\n${previousCode}` },
        { role: 'user',   content: `Apply these changes: ${userRequest}` },
      ]);
      return { isSuccess: true, generatedCode: cleanHtml(response), errors: [] };
    } catch (e) {
      return { isSuccess: false, generatedCode: null, errors: [(e as Error).message] };
    }
  }

  // GENERATE MODE — new game
  const skeleton = pickSkeleton(userRequest);
  onProgress?.(`🎮 Generating ${skeleton.name}...`);

  let lastHtml = '';
  let lastErrors: string[] = [];

  for (let attempt = 0; attempt <= 2; attempt++) {
    if (attempt > 0) onProgress?.(`🔧 Fixing issues (attempt ${attempt}/2)...`);

    try {
      const messages: any[] = attempt === 0
        ? [
            {
              role: 'system',
              content:
                `You are a God-Level Mobile Game Logic Architect. You provide only the core gameplay logic.\n\n` +
                getFullKnowledgePrompt() +
                `You must provide exactly 4 functions inside a <game_logic> block:\n` +
                `1. function init() { /* setup objects, set joy.enabled=true if needed */ }\n` +
                `2. function update() { /* physics, check swipe, apply 'Juice' */ }\n` +
                `3. function draw() { /* render ctx, use glow/particles, parallax */ }\n` +
                `4. function onTouch(e) { /* handle taps */ }\n\n` +
                `AVAILABLE GLOBALS: W, H, ctx, scale, score, state, shake, cam (x,y,zoom), joy (x,y,active,enabled), swipe (up,down,left,right), safeStorage, Part class, glow/nglow functions.\n` +
                `CRITICAL: Reset swipe flags (swipe.up=false) after reading. Adhere to qa-checklist.md.\n` +
                `Output ONLY the <game_logic> block.`,
            },
            { role: 'user', content: `Create logic for: ${userRequest}` },
          ]
        : [
            {
              role: 'system',
              content: `Fix the errors in your <game_logic> and output the corrected block:\n${lastErrors.join('\n')}`,
            },
            { role: 'user', content: lastHtml },
          ];

      const response = await generateFn(messages);
      const logicMatch = response.match(/<game_logic>([\s\S]*?)<\/game_logic>/i);
      const logic = logicMatch ? logicMatch[1].trim() : response;
      
      // Inject logic into skeleton
      const html = ultimateArcadeSkeleton.replace(
        /\/\/ ─── OVERRIDE THESE ──────────────────────────────────────────[\s\S]*?function draw\(\)\{\}/i,
        `// ─── INJECTED LOGIC ──────────────────────────────────────────\n${logic}`
      );
      
      lastHtml = logic; // store only logic for next attempt
      const errors = validate(html);
      lastErrors = errors;

      if (errors.length === 0) {
        onProgress?.('✅ Validation passed! Finalizing world-class code.');
        return { isSuccess: true, generatedCode: html, errors: [] };
      }

      onProgress?.(`⚠️ ${errors[0]}`);
      if (attempt === 2) {
        // Return best effort even with minor issues
        return { isSuccess: true, generatedCode: html, errors };
      }
    } catch (e) {
      lastErrors = [(e as Error).message];
      if (attempt === 2) return { isSuccess: false, generatedCode: null, errors: lastErrors };
    }
  }

  return { isSuccess: false, generatedCode: null, errors: lastErrors };
}

// ─── HELPERS ──────────────────────────────────────────────────
function cleanHtml(raw: string): string {
  let html = raw.trim();
  const fenced = html.match(/```(?:html)?\n?([\s\S]*?)```/s);
  if (fenced) html = fenced[1].trim();
  const start = html.search(/<(!DOCTYPE|html)/i);
  if (start > 0) html = html.slice(start);
  return html;
}
