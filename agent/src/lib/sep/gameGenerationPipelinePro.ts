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
   - Smol.Audio: .tone(freq, duration, volume, type), .playSound(id)
   - Smol.Render: .text(text, x, y, color, size), .vignette(), .scanlines()
   - Smol.W, Smol.H, Smol.GY (Ground level)
3. The game MUST start with an 'intro' state (e.g., "TAP TO START").
4. Handle input via Smol.Input.bind(() => { ... }).
5. Use modern, beautiful colors and typography (Google Fonts are allowed).
6. Ensure the game is mobile-responsive (touch friendly).

Output ONLY the raw HTML code. No talk, no explanations.`;

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
