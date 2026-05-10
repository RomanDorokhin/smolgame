/**
 * SmolGame Engine Pipeline (SEP) - Multi-Agent Game Generation Pipeline
 */

import { analyzeGameCode, ValidationReport } from './game-code-analyzer';
import { SmartInjector } from './smart-injector';

export interface GameConfig {
  gameTitle: string;
  player: { size: number; color: string; jumpHeight: number; doubleJumpEnabled: boolean; };
  world: { groundColor: string; obstacleTypes: any[]; collectibleTypes: any[]; };
  difficulty: { curve: any[]; maxGameSpeed: number; };
  audio: { sfx: any; };
  visuals: { parallaxLayers: any[]; postProcessing: any; hudColor?: string; hudGlowColor?: string; };
  social: { leaderboardEnabled: boolean; };
  mechanics?: Record<string, string>;
}

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
    // Remove comments safely without breaking strings
    cleaned = cleaned.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
    return cleaned;
  } catch(e) { return "{}"; }
};

const DIRECTOR_PROMPT = (request: string, seeds: string[]) => `
You are GameDirector. Your task is to design a high-level game concept and CHOOSE the best engine (Golden Seed) for it.

AVAILABLE SEEDS:
1. "ultimate-runner-seed": Best for side-scrolling endless runners, platformers with simple mechanics, and reflex-based games.
2. "physics-puzzle-seed": Best for physics-based puzzles, bubble shooters, gravity games, or anything where objects interact via weight and collision.

USER REQUEST: "${request}"

Output format: 
<GameDesignDoc>
  <CoreLoop>Describe the loop</CoreLoop>
  <GoldenSeed>CHOOSE ONE: ultimate-runner-seed OR physics-puzzle-seed</GoldenSeed>
</GameDesignDoc>`;

const DESIGNER_PROMPT = (gdd: string) => `
You are GameDesigner. Convert GDD to GameConfig JSON.
STRICT RULE: NO COMMENTS inside JSON.
MANDATORY STRUCTURE (Do not change keys):
{
  "gameTitle": "...",
  "player": { "size": 40, "color": "#HEX", "jumpHeight": 12, "doubleJumpEnabled": true },
  "world": { 
    "groundColor": "#HEX",
    "obstacleTypes": [{ "id": "obs1", "color": "#HEX", "width": 40, "height": 60, "spawnWeight": 1 }],
    "collectibleTypes": [{ "id": "c1", "color": "#HEX", "radius": 15, "scoreValue": 10, "spawnWeight": 1 }]
  },
  "visuals": {
    "parallaxLayers": [{ "assetUrl": "url", "speed": 0.2, "alpha": 1 }],
    "hudColor": "#HEX"
  },
  "audio": {
    "sfx": { "jump": { "freq": 400 }, "score": { "freq": 800 }, "die": { "freq": 200 } }
  },
  "difficulty": {
    "curve": [{ "scoreThreshold": 0, "gameSpeed": 5, "obstacleSpawnInterval": 1500, "collectibleSpawnInterval": 3000 }],
    "maxGameSpeed": 15
  },
  "social": { "leaderboardEnabled": true }
}

GDD: ${gdd}
Output ONLY valid JSON.`;

const CODER_PROMPT = (config: string) => `
You are GameCoder. You provide JS code for TWO specific hooks.
HOOK 1: 'CUSTOM_START_GAME_LOGIC_HOOK' (Initializes custom state)
HOOK 2: 'CUSTOM_UPDATE_LOGIC_HOOK' (Runs every frame, has access to 'dt')

CRITICAL API RULES:
1. Use 'Smol.State.set("game_over")' to end game. (NOT Smol.gm)
2. Use 'state.score' and 'state.speed'.
3. Use 'Smol.Effects.shakeScreen(intensity, duration)'.

STRICT OUTPUT FORMAT (JSON ONLY, NO COMMENTS):
{
  "CUSTOM_START_GAME_LOGIC_HOOK": "...",
  "CUSTOM_UPDATE_LOGIC_HOOK": "..."
}

Config: ${config}`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { onProgress, goldenSeeds, generateFn } = options;
  const log = (m: string) => onProgress?.(m);

  try {
    log("🎬 [Director] Designing concept...");
    const gdd = await generateFn([{ role: 'system', content: DIRECTOR_PROMPT(userRequest, Object.keys(goldenSeeds)) }]);
    const seedName = gdd.match(/<GoldenSeed>(.*?)<\/GoldenSeed>/)?.[1] || 'ultimate-runner-seed';
    const seedHtml = goldenSeeds[seedName] || goldenSeeds['ultimate-runner-seed'];

    log("🎨 [Designer] Creating initial config...");
    const configStr = await generateFn([{ role: 'system', content: DESIGNER_PROMPT(gdd) }]);
    let gameConfig = JSON.parse(cleanJson(configStr));

    let finalHtml = "";
    let report: ValidationReport | null = null;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      attempts++;
      log(`💻 [Coder] Pass ${attempts}/${maxAttempts}: Generating & Refining...`);
      
      const hooksStr = await generateFn([{ role: 'system', content: CODER_PROMPT(JSON.stringify(gameConfig)) }]);
      const rawHooks = JSON.parse(cleanJson(hooksStr));
      
      const normalizedHooks: Record<string, string> = {};
      Object.entries(rawHooks).forEach(([key, val]) => {
          if (typeof val === 'string') {
              if (key.includes('UPDATE') || Object.keys(rawHooks).length === 1) normalizedHooks['CUSTOM_UPDATE_LOGIC_HOOK'] = val;
              else if (key.includes('START')) normalizedHooks['CUSTOM_START_GAME_LOGIC_HOOK'] = val;
          }
      });
      gameConfig.mechanics = normalizedHooks;

      const injector = new SmartInjector(seedHtml, gameConfig);
      finalHtml = injector.inject();

      log("🧪 [QA] Analyzing syntax & quality...");
      report = analyzeGameCode(finalHtml);

      if (report.isValid && report.juiceScore >= 85) {
        log(`✅ [QA] Standards met on pass ${attempts}!`);
        break;
      }

      const errorList = [...report.errors, ...report.warnings].join("\n- ");
      log(`⚠️ [QA] Quality issues found (Pass ${attempts}). Self-correcting...`);
      
      const polishedConfigStr = await generateFn([
        { role: 'system', content: "You are the Master Polisher. Fix the GameConfig JSON and Mechanics to resolve the errors listed. Output ONLY valid JSON. NO COMMENTS." },
        { role: 'user', content: `CURRENT CONFIG: ${JSON.stringify(gameConfig)}\n\nERRORS TO FIX:\n- ${errorList}\n\nFIXED JSON:` }
      ]);
      gameConfig = JSON.parse(cleanJson(polishedConfigStr));
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
