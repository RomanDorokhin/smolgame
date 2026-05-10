/**
 * SmolGame Engine Pipeline (SEP) - Supreme Architect Version
 */

import { analyzeGameCode, ValidationReport } from './game-code-analyzer';
import { SmartInjector } from './smart-injector';

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

const cleanJson = (str: string) => {
  try {
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start === -1 || end === -1) return "{}";
    let cleaned = str.substring(start, end + 1);
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    return cleaned;
  } catch(e) { return "{}"; }
};

const ARCHITECT_PROMPT = (request: string, seeds: string[]) => `
You are the Supreme Game Architect. Create a COMPLETE GameConfig JSON for: "${request}".

AVAILABLE ENGINES (Golden Seeds):
- "ultimate-runner-seed": Side-scrollers, avoid obstacles, collect items.
- "physics-puzzle-seed": Physics, gravity, collisions.

ENGINE API REFERENCE:
- Smol.State: .set('playing'|'game_over'|'intro'), .is('state')
- Smol.Effects: .shakeScreen(intensity, duration), .burst(x, y, count, colors), .addParallaxLayer(url, speed)
- Smol.Audio: .tone(freq, duration, volume, type)
- Smol.Physics: .hits(rect1, rect2, padding) -> boolean
- Smol.W, Smol.H, Smol.GY (Ground Y)

MANDATORY JSON STRUCTURE:
{
  "seed": "CHOOSE ONE FROM AVAILABLE ENGINES",
  "gameTitle": "...",
  "player": { "size": 40, "color": "#HEX", "jumpHeight": 12, "doubleJumpEnabled": true },
  "world": { 
    "groundColor": "#HEX",
    "obstacleTypes": [{ "id": "o1", "color": "#HEX", "width": 40, "height": 60 }],
    "collectibleTypes": [{ "id": "c1", "color": "#HEX", "radius": 15, "scoreValue": 10 }]
  },
  "visuals": { "fontFamily": "Orbitron", "hudColor": "#FFF" },
  "audio": { "sfx": { "jump": { "freq": 400 }, "score": { "freq": 800 } } },
  "difficulty": { "curve": [{ "scoreThreshold": 0, "gameSpeed": 5 }] },
  "mechanics": {
    "CUSTOM_START_GAME_LOGIC_HOOK": "/* init code */",
    "CUSTOM_UPDATE_LOGIC_HOOK": "/* frame code - USE dt */"
  }
}

STRICT RULES:
1. Output ONLY the JSON object.
2. NO COMMENTS inside JSON.
3. DO NOT use code as keys.
4. DO NOT reinvent collision logic (engine handles it).`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { onProgress, goldenSeeds, generateFn } = options;
  const log = (m: string) => onProgress?.(m);

  try {
    log("🏗️ [Architect] Designing & Coding...");
    
    let attempts = 0;
    const maxAttempts = 5;
    let finalHtml = "";
    let report: ValidationReport | null = null;

    while (attempts < maxAttempts) {
      attempts++;
      const response = await generateFn([{ role: 'system', content: ARCHITECT_PROMPT(userRequest, Object.keys(goldenSeeds)) }]);
      const gameConfig = JSON.parse(cleanJson(response));
      
      const seedHtml = goldenSeeds[gameConfig.seed] || goldenSeeds['ultimate-runner-seed'];
      const injector = new SmartInjector(seedHtml, gameConfig);
      finalHtml = injector.inject();

      log(`🧪 [QA] Pass ${attempts}: Validating...`);
      report = analyzeGameCode(finalHtml);

      if (report.isValid && report.juiceScore >= 60) break;
      log(`⚠️ [QA] Attempt ${attempts} failed. Errors: ${report.errors.join(", ")}`);
    }

    return {
      isSuccess: report?.isValid || false,
      generatedCode: finalHtml,
      validationReport: report,
      errors: report?.errors || []
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, validationReport: null, errors: [(e as Error).message] };
  }
}
