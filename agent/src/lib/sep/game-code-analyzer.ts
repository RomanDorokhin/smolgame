/**
 * Game Code Analyzer for SEP - Ultra-Simple Version
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

  // Check for critical engine integration
  if (!htmlContent.includes("Smol.init")) {
    report.isValid = false;
    report.errors.push("Missing 'Smol.init' - the game engine is not initialized.");
  }

  if (!htmlContent.includes("smol-core.js")) {
    report.isValid = false;
    report.errors.push("Missing 'smol-core.js' script reference.");
  }

  // Feature detection for juice score
  const features = [
    { key: 'Smol.Effects.shakeScreen', score: 30, name: 'Screen Shake' },
    { key: 'Smol.Effects.burst', score: 30, name: 'Particles' },
    { key: 'Smol.Audio.tone', score: 20, name: 'SFX' },
    { key: 'parallax', score: 20, name: 'Parallax' }
  ];

  let juice = 10; // Base score for existing
  features.forEach(f => {
    if (htmlContent.includes(f.key)) {
      juice += f.score;
      report.features.push(f.name);
    }
  });

  report.juiceScore = Math.min(juice, 100);
  return report;
}
