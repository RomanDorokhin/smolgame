/**
 * SmolGame Engine Pipeline (SEP) - Multi-Agent Game Generation Pipeline
 * Implements the 5-stage architecture: Director -> Designer -> Coder -> Polisher -> QA
 * UPDATED: Data-Driven approach with JSON config and SmartInjector.
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
  mechanics?: Record<string, string>; // Custom hooks
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
    const match = str.match(/\{[\s\S]*\}/);
    if (!match) return "{}";
    let cleaned = match[0].replace(/\/\/.*$/gm, ''); // Remove single line comments
    return cleaned;
  } catch(e) { return "{}"; }
};

const DIRECTOR_PROMPT = (request: string, seeds: string[]) => `
You are GameDirector. Create a GDD in XML for: "${request}".
Available Seeds: ${seeds.join(", ")}.
Output format: <GameDesignDoc><CoreLoop>...</CoreLoop><VisualStyle>...</VisualStyle><GoldenSeed>...</GoldenSeed></GameDesignDoc>`;

const DESIGNER_PROMPT = (gdd: string) => `
You are GameDesigner. Convert GDD to GameConfig JSON.
STRICT RULE: You MUST follow this structure EXACTLY. NO COMMENTS INSIDE JSON.

MANDATORY STRUCTURE:
{
  "gameTitle": "...",
  "player": { "size": 40, "color": "#HEX", "jumpHeight": 12, "doubleJumpEnabled": true },
  "world": { 
    "groundColor": "#HEX",
    "obstacleTypes": [{ "id": "obs1", "color": "#HEX", "width": 40, "height": 60, "speedMultiplier": 1, "spawnWeight": 1 }],
    "collectibleTypes": [{ "id": "coin", "color": "#HEX", "radius": 15, "scoreValue": 10, "spawnWeight": 1 }]
  },
  "visuals": {
    "parallaxLayers": [{ "assetUrl": "url", "speed": 0.2, "yOffset": 0, "alpha": 1 }],
    "postProcessing": { "vignetteEnabled": true, "scanlinesEnabled": true, "glowEnabled": true },
    "hudColor": "#HEX", "hudGlowColor": "#HEX"
  },
  "audio": {
    "sfx": { 
      "jump": { "type": "square", "freq": 400, "duration": 0.1 },
      "score": { "type": "sine", "freq": 800, "duration": 0.1 },
      "die": { "type": "sawtooth", "freq": 200, "duration": 0.3 }
    },
    "music": []
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
You are GameCoder. Provide custom JS logic for hooks to add unique DEPTH to the game.
ENGINE CHEAT SHEET:
- 'player': { x, y, w, h, vy, color, grounded, jumpCount, isJumping, airTime }
- 'state': { score, speed, distance, powerups: { shield, magnet, boost } }
- 'Smol': { Effects: { burst(x,y,count,colors), shakeScreen(p,d) }, Audio: { tone(f,d) } }
- 'cfg': Access any value from GameConfig.

STRICT OUTPUT FORMAT:
Return ONLY a valid JSON object. NO COMMENTS INSIDE THE JSON WRAPPER.
Example:
{
  "CUSTOM_UPDATE_LOGIC_HOOK": "player.x += 1;",
  "CUSTOM_START_GAME_LOGIC_HOOK": "state.score = 100;"
}

Config: ${config}`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { onProgress, goldenSeeds, generateFn } = options;
  const log = (m: string) => onProgress?.(m);

  try {
    log("🎬 [Director] Designing high-fidelity concept...");
    const gdd = await generateFn([{ role: 'system', content: DIRECTOR_PROMPT(userRequest, Object.keys(goldenSeeds)) }]);
    const seedName = gdd.match(/<GoldenSeed>(.*?)<\/GoldenSeed>/)?.[1] || 'ultimate-runner-seed';
    const seedHtml = goldenSeeds[seedName] || goldenSeeds['ultimate-runner-seed'];

    log("🎨 [Designer] Architecting GameConfig JSON...");
    let configStr = await generateFn([{ role: 'system', content: DESIGNER_PROMPT(gdd) }]);
    let gameConfig = JSON.parse(cleanJson(configStr));

    let finalHtml = "";
    let report: ValidationReport | null = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      log(`💻 [Coder] Pass ${attempts}/${maxAttempts}: Generating logic & assembling...`);
      
      const hooksStr = await generateFn([{ role: 'system', content: CODER_PROMPT(JSON.stringify(gameConfig)) }]);
      const hooks = JSON.parse(cleanJson(hooksStr));
      gameConfig.mechanics = hooks;

      const injector = new SmartInjector(seedHtml, gameConfig);
      finalHtml = injector.inject();

      log("🧪 [QA] Analyzing quality...");
      report = analyzeGameCode(finalHtml);

      if (report.isValid && report.juiceScore >= 85) {
        log("✅ [QA] Quality standards met!");
        break;
      }

      log(`⚠️ [QA] Quality low (${report.juiceScore}/100). Polishing...`);
      const polishedConfigStr = await generateFn([
        { role: 'system', content: "You are the Polisher. Fix the GameConfig based on QA feedback. NO COMMENTS IN JSON." },
        { role: 'user', content: `Current Config: ${JSON.stringify(gameConfig)}\n\nFeedback: ${report.errors.join(", ")}` }
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
    console.error("Pipeline Error:", e);
    return { isSuccess: false, generatedCode: null, validationReport: null, errors: [(e as Error).message] };
  }
}
