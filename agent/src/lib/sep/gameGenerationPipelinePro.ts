/**
 * SmolGame Engine Pipeline (SEP) - Grounded Version
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

const INSTRUCTIONS = `
# SmolGame Agent Instructions
You MUST use the SmolGame Engine (smol-core.js).
API: Smol.init, Smol.Input.isDown, Smol.Effects.shakeScreen, Smol.Effects.applyScreenShake, Smol.Effects.burst, Smol.Render.text, Smol.Render.vignette, Smol.Render.scanlines.
Global: Smol.W, Smol.H, Smol.GY.
Rules: Use standard 'ctx' for drawing. No placeholders. Output ONLY raw HTML.`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { generateFn } = options;

  try {
    const response = await generateFn([
        { role: 'system', content: INSTRUCTIONS },
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
