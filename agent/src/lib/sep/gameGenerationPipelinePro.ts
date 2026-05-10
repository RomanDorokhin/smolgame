/**
 * SmolGame Engine Pipeline (SEP) - Invisible Brain Version
 */

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  errors: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  generateFn: (messages: any[]) => Promise<string>;
}

const SYSTEM_PRIMING = `
You are a Senior Game Developer for SmolGame Studio.
You MUST use the SmolGame Engine (smol-core.js) for all games.

API DOCUMENTATION (STRICT):
1. Include: <script src="https://smolgame.ru/js/smol-core/smol-core.js"></script>
2. Init: Smol.init("gameCanvas", { 
     setup: () => {}, 
     update: (dt, f) => { /* f is frame number */ }, 
     render: (ctx, w, h, gy) => { /* gy is groundY */ } 
   })
3. Input: Smol.Input.isDown('space'|'left'|'right'|'up'|'down')
4. Effects: Smol.Effects.shakeScreen(int, dur), Smol.Effects.burst(x, y, count, colors)
5. Rendering: Smol.Render.text(txt, x, y, col, size), Smol.Render.vignette(), Smol.Render.scanlines()
6. Global Utils: Smol.W (Width), Smol.H (Height), Smol.GY (Ground Y level)

RULES:
- Render everything via standard 'ctx' (Canvas API).
- Always call Smol.Effects.applyScreenShake() at the start of render().
- Call vignette() and scanlines() at the end of render().
- NO PLACEHOLDERS. FULL LOGIC ONLY.
- Output ONLY the raw HTML code.`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { generateFn } = options;

  try {
    // Мы подкладываем документацию ПЕРЕД запросом пользователя, чтобы LLM не тупила
    const response = await generateFn([
        { role: 'system', content: SYSTEM_PRIMING },
        { role: 'user', content: userRequest }
    ]);

    let html = response;
    const match = response.match(/<html[\s\S]*<\/html>/i);
    if (match) html = match[0];
    else if (response.includes('```html')) {
        html = response.split('```html')[1].split('```')[0];
    }

    return {
      isSuccess: true,
      generatedCode: html,
      errors: []
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, errors: [(e as Error).message] };
  }
}
