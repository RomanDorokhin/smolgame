/**
 * SmolGame Engine Pipeline (SEP) - Clean "Raw Code" Version
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

const RAW_PROMPT = (request: string) => `
You are a Game Developer. Generate a COMPLETE, standalone HTML file for: "${request}".
Use <script src="https://smolgame.ru/js/smol-core/smol-core.js"></script>.
API: Smol.init("gameCanvas", { update: (dt, f) => {...}, render: (ctx, w, h, gy) => {...} }).
Input: Smol.Input.isDown('Key') or Smol.Input.bind(() => {}).
State: Smol.State.set('playing'|'game_over'), Smol.State.is('playing').
Requirements: No placeholders, full logic, mobile-ready.
Output ONLY the raw HTML code. No comments, no explanations.`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { generateFn } = options;

  try {
    const response = await generateFn([
        { role: 'system', content: RAW_PROMPT(userRequest) }
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
