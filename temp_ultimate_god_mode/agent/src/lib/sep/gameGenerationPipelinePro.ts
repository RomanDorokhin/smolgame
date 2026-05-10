/**
 * SmolGame Engine Pipeline (SEP) - Multi-Agent Game Generation Pipeline
 * Implements the 5-stage architecture: Director -> Designer -> Coder -> Polisher -> QA
 * This pipeline orchestrates multiple AI agents to generate high-quality, production-ready games.
 */

import { generateText } from '../../llm-api'; // Assuming llm-api is one level up
import { analyzeGameCode, ValidationReport } from './game-code-analyzer';

export interface GameDesignDoc {
  coreLoop: string;
  visualStyle: string;
  atmosphere: string;
  keyMechanics: string[];
  goldenSeed: string; // e.g., 'ultimate-runner-seed'
}

export interface GameParams {
  palette: string[];
  difficultyCurve: Array<{ score: number; speed: number; spawnRate: number }>;
  sfxMap: Record<string, any>; // Detailed SFX configuration
  playerConfig: Record<string, any>;
  obstacleTypes: Array<Record<string, any>>;
  parallaxLayers: Array<{ img: string; speed: number; yOffset: number; alpha: number }>;
}

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  validationReport: ValidationReport | null;
  errors: string[];
  warnings: string[];
  debugLog: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  maxQaLoops?: number;
  goldenSeeds: Record<string, string>; // Map of seedName to HTML content
}

const DIRECTOR_PROMPT = (userRequest: string) => `
As the GameDirector AI, your task is to interpret a high-level user request and transform it into a detailed Game Design Document (GDD). The GDD must be structured in XML format and include core game loop, visual style, atmosphere, key mechanics, and a suitable Golden Seed from the available options. Prioritize rich gameplay and engaging visuals.

Available Golden Seeds: ${Object.keys(GOLDEN_SEEDS).join(', ')}

User Request: "${userRequest}"

Your output MUST be a valid XML document, like this:
<GameDesignDoc>
  <CoreLoop>Player runs, jumps, collects items, avoids obstacles.</CoreLoop>
  <VisualStyle>Cyberpunk, neon, futuristic city.</VisualStyle>
  <Atmosphere>Rainy, dark, high-tech, sense of speed.</Atmosphere>
  <KeyMechanics>
    <Mechanic>Double Jump</Mechanic>
    <Mechanic>Dynamic Difficulty Scaling</Mechanic>
    <Mechanic>Procedural Obstacle Generation</Mechanic>
  </KeyMechanics>
  <GoldenSeed>ultimate-runner-seed</GoldenSeed>
</GameDesignDoc>
`;

const DESIGNER_PROMPT = (gdd: GameDesignDoc) => `
As the GameDesigner AI, your task is to convert the provided Game Design Document (GDD) into concrete, numerical game parameters (GameParams) in JSON format. These parameters will be used by the GameCoder to populate a Golden Seed. Ensure the parameters reflect the GDD's vision for visual style, atmosphere, and mechanics.

Game Design Document:
${JSON.stringify(gdd, null, 2)}

Your output MUST be a valid JSON object, like this:
{
  "palette": ["#00FFFF", "#FF00FF", "#00FF00", "#FFD700", "#FFFFFF", "#111111"],
  "difficultyCurve": [
    { "score": 0, "speed": 5, "spawnRate": 1000 },
    { "score": 100, "speed": 7, "spawnRate": 800 },
    { "score": 500, "speed": 10, "spawnRate": 600 }
  ],
  "sfxMap": {
    "jump": { "freq": 360, "type": "square", "sweep": 580 },
    "doubleJump": { "freq": 580, "type": "square", "sweep": 880 },
    "die": { "freq": 280, "type": "sawtooth", "duration": 0.18 },
    "score": { "freq": 1100, "type": "sine", "duration": 0.04 }
  },
  "playerConfig": {
    "jumpHeight": 12,
    "doubleJumpEnabled": true,
    "trailColor": "#00FFFF",
    "color": "#00FFFF"
  },
  "obstacleTypes": [
    { "type": "block", "color": "#FF00FF", "width": 40, "height": 80, "speed": 1 },
    { "type": "spike", "color": "#00FF00", "width": 30, "height": 50, "speed": 1.2 }
  ],
  "parallaxLayers": [
    { "img": "https://example.com/cyber_sky.png", "speed": 0.1, "yOffset": 0, "alpha": 0.8 },
    { "img": "https://example.com/cyber_city_far.png", "speed": 0.3, "yOffset": 50, "alpha": 0.9 }
  ]
}
`;

const CODER_PROMPT = (gameParams: GameParams, goldenSeedContent: string) => `
As the GameCoder AI, your task is to integrate the provided GameParams into the Golden Seed HTML structure. You MUST use Smol-Core functions (Smol.init, Smol.State, Smol.Storage, Smol.Audio, Smol.Input, Smol.Physics, Smol.Render, Smol.Effects, Smol.Social, Smol.Assets) to implement the game logic and visual elements. DO NOT generate the basic engine structure; instead, populate the existing Golden Seed. Focus on implementing the core loop, player mechanics, obstacle generation, scoring, and basic visual elements using the provided parameters.

Game Parameters (JSON):
${JSON.stringify(gameParams, null, 2)}

Golden Seed HTML (integrate your code into the <script> section):
${goldenSeedContent}

Your output MUST be the complete, modified HTML file. Ensure all Smol-Core functions are called correctly and parameters are used.
`;

const POLISHER_PROMPT = (rawGameCode: string, feedback: string = "") => `
As the GamePolisher AI, your task is to enhance the provided raw game code by adding "Juice" effects, optimizing visuals, and fixing any minor issues. You MUST ensure the game is visually stunning and engaging. Pay close attention to particles, screen shake, glow effects, post-processing, and sound integration. If specific feedback is provided, address it.

Raw Game Code:
${rawGameCode}

Feedback: ${feedback || "No specific feedback. Focus on maximizing juice and polish."}

Your output MUST be the complete, polished HTML file. Ensure all Smol-Core functions for effects are utilized.
`;

const QA_PROMPT = (polishedGameCode: string, validationReport: ValidationReport) => `
As the GameQA AI, your task is to review the polished game code and the validation report. Your goal is to provide constructive feedback to the GamePolisher if the game does not meet the required quality and security standards. If the game is perfect, simply state "APPROVED".

Polished Game Code:
${polishedGameCode}

Validation Report:
${JSON.stringify(validationReport, null, 2)}

If the game is not valid (report.isValid === false) or the juiceScore is below 85, or securityScore is below 90, provide detailed, actionable feedback to the GamePolisher on how to improve the code. Focus on specific Smol-Core functions to use or security patterns to avoid. Otherwise, respond with "APPROVED".
`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const debugLog: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const { onProgress, maxQaLoops = 3, goldenSeeds } = options;

  const log = (msg: string) => { debugLog.push(msg); if (onProgress) onProgress(msg); };
  const addError = (msg: string) => { errors.push(msg); log(`ERROR: ${msg}`); };
  const addWarning = (msg: string) => { warnings.push(msg); log(`WARNING: ${msg}`); };

  let gdd: GameDesignDoc | null = null;
  let gameParams: GameParams | null = null;
  let rawGameCode: string | null = null;
  let polishedGameCode: string | null = null;
  let validationReport: ValidationReport | null = null;

  try {
    // --- Stage 1: GameDirector (Conceptualization) ---
    log("Stage 1: GameDirector - Conceptualizing game design...");
    const directorResponse = await generateText(DIRECTOR_PROMPT(userRequest));
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(directorResponse, "text/xml");
      const getTagContent = (tagName: string) => xmlDoc.getElementsByTagName(tagName)[0]?.textContent || "";
      gdd = {
        coreLoop: getTagContent("CoreLoop"),
        visualStyle: getTagContent("VisualStyle"),
        atmosphere: getTagContent("Atmosphere"),
        keyMechanics: Array.from(xmlDoc.getElementsByTagName("Mechanic")).map(el => el.textContent || ""),
        goldenSeed: getTagContent("GoldenSeed")
      };
      if (!goldenSeeds[gdd.goldenSeed]) {
        addError(`GameDirector selected unknown Golden Seed: ${gdd.goldenSeed}. Falling back to 'ultimate-runner-seed'.`);
        gdd.goldenSeed = 'ultimate-runner-seed'; // Fallback
      }
      log("GameDesignDoc generated successfully.");
    } catch (e) {
      addError(`Failed to parse GameDirector response: ${e}. Response: ${directorResponse}`);
      return { isSuccess: false, generatedCode: null, validationReport: null, errors, warnings, debugLog };
    }

    // --- Stage 2: GameDesigner (Parameter Generation) ---
    log("Stage 2: GameDesigner - Generating game parameters...");
    const designerResponse = await generateText(DESIGNER_PROMPT(gdd));
    try {
      gameParams = JSON.parse(designerResponse);
      log("GameParams generated successfully.");
    } catch (e) {
      addError(`Failed to parse GameDesigner response: ${e}. Response: ${designerResponse}`);
      return { isSuccess: false, generatedCode: null, validationReport: null, errors, warnings, debugLog };
    }

    // --- Stage 3: GameCoder (Code Generation from Seed) ---
    log("Stage 3: GameCoder - Integrating parameters into Golden Seed...");
    const goldenSeedContent = goldenSeeds[gdd.goldenSeed];
    if (!goldenSeedContent) {
      addError(`Golden Seed content for '${gdd.goldenSeed}' not found.`);
      return { isSuccess: false, generatedCode: null, validationReport: null, errors, warnings, debugLog };
    }
    rawGameCode = await generateText(CODER_PROMPT(gameParams, goldenSeedContent));
    log("Raw game code generated.");

    // --- Stage 4 & 5: GamePolisher & GameQA (Iterative Polish and Validation) ---
    polishedGameCode = rawGameCode;
    let qaLoops = 0;
    let qaFeedback = "";

    while (qaLoops < maxQaLoops) {
      log(`Stage 4: GamePolisher - Polishing game code (QA Loop ${qaLoops + 1}/${maxQaLoops})...`);
      polishedGameCode = await generateText(POLISHER_PROMPT(polishedGameCode, qaFeedback));
      log("Polished game code generated. Running QA...");

      validationReport = analyzeGameCode(polishedGameCode);
      log(`QA Report: isValid=${validationReport.isValid}, juiceScore=${validationReport.juiceScore}, securityScore=${validationReport.securityScore}`);
      validationReport.errors.forEach(e => addError(e));
      validationReport.warnings.forEach(w => addWarning(w));

      if (validationReport.isValid && validationReport.juiceScore >= 85 && validationReport.securityScore >= 90) {
        log("Stage 5: GameQA - Game APPROVED!");
        return { isSuccess: true, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
      } else {
        qaFeedback = await generateText(QA_PROMPT(polishedGameCode, validationReport));
        log(`QA Feedback: ${qaFeedback}`);
        if (qaFeedback.includes("APPROVED")) { // QA might approve even if scores are slightly off, if it thinks it's good enough
          log("Stage 5: GameQA - Game APPROVED despite minor issues.");
          return { isSuccess: true, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
        }
        qaLoops++;
      }
    }

    addError(`Game failed to pass QA after ${maxQaLoops} iterations. Final report: ${JSON.stringify(validationReport)}`);
    return { isSuccess: false, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };

  } catch (e: any) {
    addError(`Pipeline execution failed: ${e.message || e}`);
    return { isSuccess: false, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
  }
}
