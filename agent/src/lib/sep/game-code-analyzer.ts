/**
 * Game Code Analyzer for SEP - Ultra-Strict "Honest" Version
 */

export interface ValidationReport {
  isValid: boolean;
  juiceScore: number;
  errors: string[];
  warnings: string[];
  features: string[];
}

export function analyzeGameCode(htmlContent: string): ValidationReport {
  const report: ValidationReport = {
    isValid: true,
    juiceScore: 0,
    errors: [],
    warnings: [],
    features: []
  };

  if (!htmlContent || htmlContent.length < 100) {
    report.isValid = false;
    report.errors.push("HTML content is too short or empty.");
    return report;
  }

  // CRITICAL HALLUCINATION CHECKS
  if (htmlContent.includes("click:") && htmlContent.includes("Smol.init")) {
    report.isValid = false;
    report.errors.push("API Error: Smol.init does NOT support a 'click' property. Use Smol.Input.bind() instead.");
  }

  if (htmlContent.includes("f.input") || htmlContent.includes("dt.input")) {
    report.isValid = false;
    report.errors.push("API Error: update() arguments 'dt' and 'f' are numbers, not objects. Use Smol.Input global.");
  }

  if (htmlContent.includes("gy.shakeX") || htmlContent.includes("gy.shakeY")) {
    report.isValid = false;
    report.errors.push("API Error: 'gy' is a GroundY number, not an object. Use Smol.Effects.applyScreenShake() instead.");
  }

  if (!htmlContent.includes("Smol.init")) {
    report.isValid = false;
    report.errors.push("Missing 'Smol.init' - the game engine is not initialized.");
  }

  // Force juice to 0 if invalid
  if (!report.isValid) {
    report.juiceScore = 0;
    return report;
  }

  // Feature detection for juice score
  const features = [
    { key: 'Smol.Effects.shakeScreen', score: 30, name: 'Screen Shake' },
    { key: 'Smol.Effects.burst', score: 30, name: 'Particles' },
    { key: 'Smol.Audio.tone', score: 20, name: 'SFX' },
    { key: 'vignette', score: 20, name: 'Post-Processing' }
  ];

  let juice = 20; 
  features.forEach(f => {
    if (htmlContent.includes(f.key)) {
      juice += f.score;
      report.features.push(f.name);
    }
  });

  report.juiceScore = Math.min(juice, 100);
  return report;
}
