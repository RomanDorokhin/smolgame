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
  llmConfig?: any; // Added for SmolAgent
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

// ─── MAIN PIPELINE (MULTI-STAGE) ──────────────────────────────
export async function generateGame(
  userRequest: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  const { generateFn, previousCode, onProgress } = options;
  if (typeof generateFn !== 'function') throw new Error('generateFn is required');

  // EDIT MODE (Legacy fallback for simple tweaks)
  if (previousCode) {
    onProgress?.('🛠 Refining existing game...');
    const response = await generateFn([
      { role: 'system', content: 'You are a Senior Fullstack Game Developer. Edit the code in <game_spec>. No talk.' },
      { role: 'system', content: `CURRENT_CODE:\n${previousCode}` },
      { role: 'user', content: userRequest }
    ]);
    return { isSuccess: true, generatedCode: cleanHtml(response), errors: [] };
  }

  // --- STAGE 1: THE ARCHITECT (SPECIFICATION) ---
  onProgress?.('🏗 ARCHITECT: Designing technical specification...');
  const specResponse = await generateFn([
    { 
      role: 'system', 
      content: `You are the Lead Game Architect. 
KNOWLEDGE: ${getFullKnowledgePrompt()}
TASK: Decompose the request into a technical <plan>. Focus on 9:16 mobile, Physics (AABB/Circle), and Juice (Glow, Particles, Shake).` 
    },
    { role: 'user', content: userRequest }
  ]);
  const planMatch = specResponse.match(/<plan>([\s\S]*?)<\/plan>/i);
  const plan = planMatch ? planMatch[1].trim() : specResponse;

  // --- STAGE 2: THE ENGINEER (IMPLEMENTATION) ---
  onProgress?.('💻 ENGINEER: Implementing high-performance logic...');
  
  // RAG: Extract genre to filter knowledge
  const genreMatch = plan.match(/Genre:\s*(\w+)/i);
  const genre = genreMatch ? genreMatch[1].toLowerCase() : undefined;

  const engineerResponse = await generateFn([
    { 
      role: 'system', 
      content: `You are a Senior Systems Engineer.
KNOWLEDGE: ${getFullKnowledgePrompt(genre)}
ENGINE: ultimate-mobile (Globals: W, H, scale, ctx, joy, swipe, cam, Part, glow, sfx).
STRICT: DO NOT define 'class Part'. It is already provided.
STRICT: DO NOT define 'class Joystick' or 'class Camera'.
STRICT: DO NOT change 'state'. The engine handles state.
STRICT: DO NOT include markdown (###, ####, etc.) or any prose/explanation.
TASK: Implement 4 functions (init, update, draw, onTouch) based on the <plan>.
STRICT: Reset swipe flags. Use 'scale' for all sizes. Output ONLY <game_logic>.` 
    },
    { role: 'system', content: `<plan>\n${plan}\n</plan>` },
    { role: 'user', content: 'Implement the logic now.' }
  ]);
  
  let logic = engineerResponse.match(/<game_logic>([\s\S]*?)<\/game_logic>/i)?.[1].trim() || engineerResponse;
  
  // Hard-strip markdown and prose that LLMs often hallucinate inside tags
  logic = logic
    .replace(/^#+.*$/gm, '') // Remove all markdown headers
    .replace(/^\*\*.*?\*\*$/gm, '') // Remove bold lines
    .replace(/^(The|This|In this|Here is|Note:|Important:).*?$/gim, '') // Remove prose
    .replace(/```javascript|```js|```html|```/g, '') // Remove code blocks
    .replace(/<thought>[\s\S]*?<\/thought>/gi, '')
    .replace(/<qa_self_audit>[\s\S]*?<\/qa_self_audit>/gi, '')
    .trim();

  // Sanity check
  const required = ['function init', 'function update', 'function draw', 'function onTouch'];
  const missing = required.filter(fn => !logic.includes(fn));
  if (missing.length > 0) {
    onProgress?.(`❌ ERROR: Engineer missed ${missing.length} functions. Retrying Implementation...`);
    throw new Error(`Engineer hallucinated a partial response. Missing: ${missing.join(', ')}`);
  }

  // --- STAGE 3: THE CRITIC (REFINEMENT & JUICE) ---
  onProgress?.('✨ CRITIC: Validating alignment with plan & injecting juice...');
  const finalHtml = ultimateArcadeSkeleton.replace(
    '/* INJECT_LOGIC_HERE */',
    `// ─── INJECTED LOGIC ──────────────────────────────────────────\n${logic}`
  );

  const errors = validate(finalHtml);
  if (errors.length > 0) {
    onProgress?.(`🔧 AUTO-FIX: Разрешаю ${errors.length} технических несоответствий...`);
    
    const agent = new SmolAgent({
      llm: options.llmConfig!, // I'll need to pass this in options
      onProgress: (m) => onProgress?.(`QA: ${m}`),
    });

    const fixedLogic = await agent.runFixLoop(
      `Fix these errors and boost juice to 9/10: ${errors.join(', ')}`,
      logic
    );

    const finalPolishedHtml = ultimateArcadeSkeleton.replace(
      '/* INJECT_LOGIC_HERE */',
      `// ─── INJECTED LOGIC ──────────────────────────────────────────\n${fixedLogic}`
    );
    return { isSuccess: true, generatedCode: finalPolishedHtml, errors: validate(finalPolishedHtml) };
  }

  return { isSuccess: true, generatedCode: finalHtml, errors: [] };
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
