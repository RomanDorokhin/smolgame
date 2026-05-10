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
STRICT RULE: NO COMMENTS. USE ONLY THESE KEYS: gameTitle, player, world, visuals, audio, difficulty, social.
GDD: ${gdd}`;

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

    log("🎨 [Designer] Creating config...");
    const configStr = await generateFn([{ role: 'system', content: DESIGNER_PROMPT(gdd) }]);
    let gameConfig = JSON.parse(cleanJson(configStr));

    log("💻 [Coder] Writing logic...");
    const hooksStr = await generateFn([{ role: 'system', content: CODER_PROMPT(JSON.stringify(gameConfig)) }]);
    const rawHooks = JSON.parse(cleanJson(hooksStr));
    
    // Normalize hooks (in case AI used wrong keys)
    const normalizedHooks: Record<string, string> = {};
    Object.entries(rawHooks).forEach(([key, val]) => {
        if (typeof val === 'string') {
            if (key.includes('UPDATE') || Object.keys(rawHooks).length === 1) normalizedHooks['CUSTOM_UPDATE_LOGIC_HOOK'] = val;
            else if (key.includes('START')) normalizedHooks['CUSTOM_START_GAME_LOGIC_HOOK'] = val;
        }
    });
    gameConfig.mechanics = normalizedHooks;

    const injector = new SmartInjector(seedHtml, gameConfig);
    const finalHtml = injector.inject();

    log("🧪 [QA] Checking quality...");
    const report = analyzeGameCode(finalHtml);

    return {
      isSuccess: report.isValid,
      generatedCode: finalHtml,
      validationReport: report,
      errors: report.errors
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, validationReport: null, errors: [(e as Error).message] };
  }
}
