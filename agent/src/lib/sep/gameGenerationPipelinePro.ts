/**
 * SmolGame Engine Pipeline (SEP) - Ultra-Simple "One-Shot" Version
 */

import { analyzeGameCode, ValidationReport } from './game-code-analyzer';

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  validationReport: ValidationReport | null;
  errors: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  goldenSeeds: Record<string, string>;
  generateFn: (messages: any[]) => Promise<string>;
}

const SUPREME_PROMPT = (request: string) => `
You are a Senior Game Developer for SmolGame Studio.
Your task is to generate a COMPLETE, standalone HTML file for a game based on this request: "${request}".

STRICT TECHNICAL REQUIREMENTS:
1. Include: <script src="https://smolgame.ru/js/smol-core/smol-core.js"></script> in <head>.
2. Use Smol Engine API:
   - Smol.init("gameCanvas", { update: (dt, f) => {...}, render: (ctx, w, h, gy) => {...} })
   - Smol.State: .set('playing'|'game_over'|'intro'), .is('state')
   - Smol.Effects: .shakeScreen(intensity, duration), .burst(x, y, count, colors)
   - Smol.Audio: .tone(freq, duration, volume, type)
   - Smol.Render: .text(text, x, y, color, size), .vignette(), .scanlines()
3. CRITICAL: NO PLACEHOLDERS. DO NOT use comments like "// logic goes here" or "// handle collisions".
4. FULL IMPLEMENTATION: Every single mechanic (movement, collisions, scoring, state transitions) MUST be fully coded and functional.
5. The game MUST start with an 'intro' state and have a working 'game_over' state.
6. Use modern, beautiful aesthetics (even for retro themes) and ensure mobile responsiveness.

Output ONLY the raw HTML code. Be a coding god. Fully finish the game.`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { onProgress, generateFn } = options;
  const log = (m: string) => onProgress?.(m);

  try {
    log("🚀 [System] Generating game in one shot...");
    
    const response = await generateFn([
        { role: 'system', content: SUPREME_PROMPT(userRequest) }
    ]);

    // Extract HTML if LLM added markdown backticks
    let html = response;
    const match = response.match(/<html[\s\S]*<\/html>/i);
    if (match) html = match[0];
    else if (response.includes('```html')) {
        html = response.split('```html')[1].split('```')[0];
    }

    log("🧪 [QA] Basic validation...");
    const report = analyzeGameCode(html);

    return {
      isSuccess: true, // In "Simple Mode", we always try to run what we got
      generatedCode: html,
      validationReport: report,
      errors: report.errors
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, validationReport: null, errors: [(e as Error).message] };
  }
}
