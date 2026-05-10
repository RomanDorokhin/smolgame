/**
 * Game Code Analyzer for SEP
 * Evaluates the quality and validity of generated game code.
 */

export interface ValidationReport {
  isValid: boolean;
  juiceScore: number;
  errors: string[];
  warnings: string[];
  features: string[];
}

function validateSyntax(code: string): string | null {
  try {
    new Function(code);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export function analyzeGameCode(htmlContent: string): ValidationReport {
  const report: ValidationReport = {
    isValid: true,
    juiceScore: 0,
    errors: [],
    warnings: [],
    features: []
  };

  if (!htmlContent) {
    report.isValid = false;
    report.errors.push("HTML content is empty.");
    return report;
  }

  // Extract JS from script tags for syntax check (Skip JSON config tags)
  const scriptRegex = /<script([\s\S]*?)>([\s\S]*?)<\/script>/g;
  let match;
  while ((match = scriptRegex.exec(htmlContent)) !== null) {
    const attributes = match[1];
    const code = match[2];
    
    // Skip application/json scripts
    if (attributes.includes('type="application/json"')) continue;
    
    const syntaxError = validateSyntax(code);
    if (syntaxError) {
      report.isValid = false;
      report.errors.push(`JS Syntax Error: ${syntaxError}`);
    }
  }

  // Force juice to 0 if syntax is broken
  if (!report.isValid) {
    report.juiceScore = 0;
    return report;
  }

  let juice = 0;
  
  // Feature detection
  const features = [
    { key: 'Smol.Effects.shakeScreen', score: 30, name: 'Screen Shake' },
    { key: 'Smol.Effects.burst', score: 30, name: 'Particle Bursts' },
    { key: 'Smol.Audio.tone', score: 20, name: 'Procedural Audio' },
    { key: 'parallaxLayers', score: 20, name: 'Parallax Backgrounds' }
  ];

  let foundCriticalLogic = htmlContent.includes("CUSTOM_UPDATE_LOGIC_HOOK") || htmlContent.includes("mechanics");
  
  features.forEach(f => {
    if (htmlContent.includes(f.key)) {
      juice += f.score;
      report.features.push(f.name);
    }
  });

  // Font bonus
  if (htmlContent.includes("fontFamily") && !htmlContent.includes("Press Start 2P")) {
      juice += 10;
      report.features.push("Premium Typography");
  }

  if (!foundCriticalLogic) {
      report.isValid = false;
      report.errors.push("Missing critical game logic hooks.");
      juice = 0;
  }

  report.juiceScore = Math.min(juice, 100);
  return report;
}
