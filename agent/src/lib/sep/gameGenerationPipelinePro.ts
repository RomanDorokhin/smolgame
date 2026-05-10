import { ValidationReport, analyzeGameCode } from './game-code-analyzer';

export interface GameDesignDoc {
  coreLoop: string;
  visualStyle: string;
  atmosphere: string;
  keyMechanics: string[];
  goldenSeed: string;
}

export interface GameParams {
  palette: string[];
  difficultyCurve: Array<{ score: number; speed: number; spawnRate: number }>;
  sfxMap: Record<string, any>;
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
  goldenSeeds: Record<string, string>;
  /** Function to generate text, allowing useGameAgent to inject fallback logic */
  generateFn: (prompt: string, systemPrompt?: string) => Promise<string>;
}

const DIRECTOR_PROMPT = (userRequest: string, seeds: string[]) => `
GameDirector: Create GDD in XML for user request: "${userRequest}".
Seeds: ${seeds.join(', ')}.
Output ONLY XML:
<GameDesignDoc>
  <CoreLoop>...</CoreLoop>
  <VisualStyle>...</VisualStyle>
  <Atmosphere>...</Atmosphere>
  <KeyMechanics><Mechanic>...</Mechanic></KeyMechanics>
  <GoldenSeed>...</GoldenSeed>
</GameDesignDoc>`;

const DESIGNER_PROMPT = (gdd: GameDesignDoc) => `
GameDesigner: Convert GDD to JSON parameters.
GDD: ${JSON.stringify(gdd)}
Output ONLY JSON:
{
  "palette": ["#hex",...],
  "difficultyCurve": [{"score":0,"speed":5,"spawnRate":1000},...],
  "sfxMap": {"event":{"freq":400,"type":"square"}},
  "playerConfig": {"jumpHeight":12,"doubleJumpEnabled":true},
  "obstacleTypes": [{"type":"block","color":"#hex","width":40,"height":80}],
  "parallaxLayers": [{"img":"url","speed":0.1}]
}`;

const CODER_PROMPT = (gameParams: GameParams, goldenSeedContent: string) => `
GameCoder: Integrate GameParams into Golden Seed. 
STRICT RULES:
1. Use ONLY Smol-Core API. NO standard 'new Audio()', 'requestAnimationFrame', or manual 'ctx' loops.
2. Use 'Smol.init(canvasId, {update, render})' for game loop.
3. Use 'Smol.Audio.tone(freq, dur, vol, type, targetFreq)' for SFX.
4. Use 'Smol.Effects' for everything: 'addParallaxLayer', 'burst' (particles), 'shakeScreen', 'renderParallax'.
5. Use 'Smol.Physics.hits(a, b, pad)' for collisions.
6. Use 'Smol.Render' for juice: 'gl' (glow), 'text' (neon text), 'vignette', 'scanlines'.

Params: ${JSON.stringify(gameParams)}
Seed: ${goldenSeedContent}
Output ONLY complete HTML.`;

const POLISHER_PROMPT = (rawGameCode: string, feedback: string = "") => `
GamePolisher: Maximize "Juice" using Smol-Core Effects.
- Add 'Smol.Effects.burst' on collection/death.
- Add 'Smol.Effects.shakeScreen' on jump/hit.
- Add 'Smol.Render.gl' (glow) to all moving objects.
- Add 'Smol.Render.vignette()' and 'scanlines()' in render function.
- Fix any logic bugs using Smol-Core methods.
Feedback: ${feedback}
Code: ${rawGameCode}
Output ONLY complete HTML.`;

const QA_PROMPT = (polishedGameCode: string, validationReport: ValidationReport) => `
GameQA: Review code/report. Return "APPROVED" or specific fix instructions.
Report: ${JSON.stringify(validationReport)}
Code: ${polishedGameCode}`;

function extractCodeBlock(text: string, tag?: string): string {
  if (tag) {
    const regex = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, 'i');
    const match = text.match(regex);
    if (match) return match[1].trim();
  }
  
  const markdownRegex = /```(?:json|xml|html|javascript|typescript)?\s*([\s\S]*?)```/gi;
  const markdownMatch = markdownRegex.exec(text);
  if (markdownMatch) return markdownMatch[1].trim();

  if (text.includes('{') && text.includes('}')) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const potentialJson = text.substring(start, end + 1).trim();
    try {
      JSON.parse(potentialJson);
      return potentialJson;
    } catch (e) {}
  }
  
  return text.trim();
}

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const debugLog: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const { onProgress, maxQaLoops = 3, goldenSeeds, generateFn } = options;

  const log = (msg: string) => { debugLog.push(msg); if (onProgress) onProgress(msg); };
  const addError = (msg: string) => { errors.push(msg); log(`ERROR: ${msg}`); };
  const addWarning = (msg: string) => { warnings.push(msg); log(`WARNING: ${msg}`); };

  let gdd: GameDesignDoc | null = null;
  let gameParams: GameParams | null = null;
  let rawGameCode: string | null = null;
  let polishedGameCode: string | null = null;
  let validationReport: ValidationReport | null = null;

  try {
    // Stage 1
    log("Stage 1: GameDirector...");
    let dirResp = await generateFn(DIRECTOR_PROMPT(userRequest, Object.keys(goldenSeeds)), "Game Director AI");
    dirResp = extractCodeBlock(dirResp, "GameDesignDoc");
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(dirResp, "text/xml");
      const getTagContent = (tagName: string) => xmlDoc.getElementsByTagName(tagName)[0]?.textContent || "";
      gdd = {
        coreLoop: getTagContent("CoreLoop"),
        visualStyle: getTagContent("VisualStyle"),
        atmosphere: getTagContent("Atmosphere"),
        keyMechanics: Array.from(xmlDoc.getElementsByTagName("Mechanic")).map(el => el.textContent || ""),
        goldenSeed: getTagContent("GoldenSeed") || "ultimate-runner-seed"
      };
      if (!goldenSeeds[gdd.goldenSeed]) gdd.goldenSeed = 'ultimate-runner-seed';
    } catch (e) {
      addError(`Director XML parse failed: ${e}`);
      return { isSuccess: false, generatedCode: null, validationReport: null, errors, warnings, debugLog };
    }

    // Stage 2
    log("Stage 2: GameDesigner...");
    let desResp = await generateFn(DESIGNER_PROMPT(gdd), "Game Designer AI");
    try {
      gameParams = JSON.parse(extractCodeBlock(desResp));
    } catch (e) {
      addError(`Designer JSON parse failed: ${e}`);
      return { isSuccess: false, generatedCode: null, validationReport: null, errors, warnings, debugLog };
    }

    // Stage 3
    log("Stage 3: GameCoder...");
    const seedContent = goldenSeeds[gdd.goldenSeed];
    let codeResp = await generateFn(CODER_PROMPT(gameParams, seedContent), "Expert Game Programmer");
    rawGameCode = extractCodeBlock(codeResp);

    // Stage 4 & 5
    polishedGameCode = rawGameCode;
    let qaLoops = 0;
    let qaFeedback = "";

    while (qaLoops < maxQaLoops) {
      log(`Stage 4: Polisher (Loop ${qaLoops + 1})...`);
      let polResp = await generateFn(POLISHER_PROMPT(polishedGameCode, qaFeedback), "Game Polisher");
      polishedGameCode = extractCodeBlock(polResp);

      validationReport = analyzeGameCode(polishedGameCode);
      if (validationReport.isValid && validationReport.juiceScore >= 85 && validationReport.securityScore >= 90) {
        log("Stage 5: QA APPROVED!");
        return { isSuccess: true, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
      } else {
        qaFeedback = await generateFn(QA_PROMPT(polishedGameCode, validationReport), "Game QA");
        if (qaFeedback.toUpperCase().includes("APPROVED")) {
          return { isSuccess: true, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
        }
        qaLoops++;
      }
    }

    return { isSuccess: true, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };

  } catch (e: any) {
    addError(`Pipeline failed: ${e.message || e}`);
    return { isSuccess: false, generatedCode: polishedGameCode, validationReport, errors, warnings, debugLog };
  }
}
