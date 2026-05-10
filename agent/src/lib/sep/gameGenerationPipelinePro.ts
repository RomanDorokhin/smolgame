import arcadeCanvasSkeleton from '../skeletons/arcade-canvas.html?raw';
import physicsPuzzleSkeleton from '../skeletons/physics-puzzle.html?raw';
import narrativeMysterySkeleton from '../skeletons/narrative-mystery.html?raw';
import ultimateArcadeSkeleton from '../skeletons/ultimate-arcade.html?raw';

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
const SKELETONS = {
  runner: {
    name: 'Runner',
    html: ultimateArcadeSkeleton,
    keywords: ['раннер', 'runner', 'беги', 'бесконечный', 'endless', 'прыжки', 'препятствия', 'obstacle'],
  },
  puzzle: {
    name: 'Physics Puzzle',
    html: physicsPuzzleSkeleton,
    keywords: ['пазл', 'puzzle', 'физик', 'physics', 'шар', 'ball', 'докатить', 'головоломка'],
  },
  narrative: {
    name: 'Narrative',
    html: narrativeMysterySkeleton,
    keywords: ['история', 'story', 'нарратив', 'текст', 'выбор', 'choice', 'новелла', 'детектив', 'диалог'],
  },
  arcade: {
    name: 'Arcade',
    html: arcadeCanvasSkeleton,
    keywords: [], // default fallback
  },
};

function pickSkeleton(request: string) {
  const lower = request.toLowerCase();
  for (const [, s] of Object.entries(SKELETONS)) {
    if (s.keywords.some(kw => lower.includes(kw))) return s;
  }
  return SKELETONS.arcade; // default
}

// ─── BASIC VALIDATOR ──────────────────────────────────────────
function validate(html: string): string[] {
  const errors: string[] = [];
  if (html.length < 1500)              errors.push('Output too short — incomplete game.');
  if (!html.includes('<canvas'))       errors.push('Missing <canvas> element.');
  if (!html.includes('requestAnimationFrame') && !html.includes('Engine.update'))
                                       errors.push('Must use requestAnimationFrame for game loop.');
  if (/location\.reload\s*\(\)/.test(html)) errors.push('FORBIDDEN: location.reload() — use resetGame() instead.');
  if (!html.includes('pointerdown'))   errors.push('Missing pointerdown — required for mobile touch.');
  return errors;
}

// ─── MAIN PIPELINE ────────────────────────────────────────────
export async function generateGame(
  userRequest: string,
  options: PipelineOptions
): Promise<PipelineResult> {
  const { generateFn, previousCode, onProgress } = options;

  // EDIT MODE — user is tweaking an existing game
  if (previousCode) {
    onProgress?.('🛠 Applying changes...');
    try {
      const response = await generateFn([
        {
          role: 'system',
          content: `You are a Senior Game Developer. Modify the game based on user instructions.
Use SEARCH/REPLACE blocks or output the full new HTML. Code only, no explanations.`,
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
                `ЭТО ИГРА ДОЛЖНА БЫТЬ МИРОВОГО УРОВНЯ ТЫ ДЕЛАЕШЬ ИСТОРИЮ так что напиши ее без багов.\n\n` +
                `You are a World-Class HTML5 Game Developer.\n` +
                `Below is a WORKING game skeleton. Customize it to match the user request.\n` +
                `Keep ALL juice code (particles, screen shake, audio, safeStorage) EXACTLY as-is.\n` +
                `Only replace the game-logic section (marked with REPLACE THIS SECTION comments).\n` +
                `NEVER use location.reload() — use resetGame() instead.\n` +
                `NEVER add external libraries.\n` +
                `Output ONLY the complete HTML file. No markdown. No explanations.\n\n` +
                `SKELETON:\n${skeleton.html}`,
            },
            { role: 'user', content: `Create this game: ${userRequest}` },
          ]
        : [
            {
              role: 'system',
              content:
                `ЭТО ИГРА ДОЛЖНА БЫТЬ МИРОВОГО УРОВНЯ ТЫ ДЕЛАЕШЬ ИСТОРИЮ так что напиши ее без багов.\n\n` +
                `Fix these errors in the game and output the complete corrected HTML:\n` +
                `${lastErrors.map(e => `• ${e}`).join('\n')}`,
            },
            { role: 'user', content: lastHtml },
          ];

      const response = await generateFn(messages);
      const html = cleanHtml(response);
      lastHtml = html;

      const errors = validate(html);
      lastErrors = errors;

      if (errors.length === 0) {
        onProgress?.('✅ Done!');
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
