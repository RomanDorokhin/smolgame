/**
 * SmolGame Engine Pipeline (SEP) - Multi-Agent Game Generation Pipeline
 * Implements the 5-stage architecture: Director -> Designer -> Coder -> Polisher -> QA
 * UPDATED: Data-Driven approach with JSON config and SmartInjector.
 */

import { generateText } from '../llm-api';
import { analyzeGameCode, ValidationReport } from './game-code-analyzer';
import { SmartInjector } from './smart-injector';

export interface GameConfig {
  gameTitle: string;
  player: { size: number; color: string; jumpHeight: number; doubleJumpEnabled: boolean; };
  world: { obstacleTypes: any[]; collectibleTypes: any[]; };
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

const DIRECTOR_PROMPT = (request: string, seeds: string[]) => `
You are GameDirector. Create a GDD in XML for: "${request}".
Available Seeds: ${seeds.join(", ")}.
Output format: <GameDesignDoc><CoreLoop>...</CoreLoop><VisualStyle>...</VisualStyle><GoldenSeed>...</GoldenSeed></GameDesignDoc>`;

const DESIGNER_PROMPT = (gdd: string) => `
You are GameDesigner. Convert GDD to GameConfig JSON based on the schema.
GDD: ${gdd}
Output ONLY valid JSON.`;

const CODER_PROMPT = (config: string) => `
You are GameCoder. Provide custom JS logic for hooks if needed (onPlayerHit, customUpdateLogic).
Config: ${config}
Output JSON: {"hookName": "js code"}`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { onProgress, goldenSeeds } = options;
  const logs: string[] = [];
  const log = (m: string) => { logs.push(m); onProgress?.(m); };

  try {
    // 1. Director
    log("🎬 Director: Designing game concept...");
    const gdd = await options.generateFn([{ role: 'system', content: DIRECTOR_PROMPT(userRequest, Object.keys(goldenSeeds)) }]);
    
    // 2. Designer
    log("🎨 Designer: Creating GameConfig JSON...");
    const configStr = await options.generateFn([{ role: 'system', content: DESIGNER_PROMPT(gdd) }]);
    const gameConfig = JSON.parse(configStr.replace(/```json|```/g, ''));

    // 3. Coder (Custom Hooks)
    log("💻 Coder: Generating custom logic hooks...");
    const hooksStr = await options.generateFn([{ role: 'system', content: CODER_PROMPT(configStr) }]);
    const hooks = JSON.parse(hooksStr.replace(/```json|```/g, '') || "{}");
    gameConfig.mechanics = hooks;

    // 4. Assemble with SmartInjector
    log("🛠 SmartInjector: Assembling final game HTML...");
    const seedName = gdd.match(/<GoldenSeed>(.*?)<\/GoldenSeed>/)?.[1] || 'ultimate-runner-seed';
    const seedHtml = goldenSeeds[seedName] || goldenSeeds['ultimate-runner-seed'];
    
    const injector = new SmartInjector(seedHtml, gameConfig);
    const finalHtml = injector.inject();

    // 5. QA Analysis
    log("🧪 QA: Validating game code...");
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
