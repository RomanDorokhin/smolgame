/**
 * SmolGame Ultra-Strict Code Analyzer (35-Point Standard)
 * Enforces technical and visual excellence for the "YouTube of Games".
 */

export interface ValidationReport {
  isValid: boolean;
  juiceScore: number;
  errors: string[];
  warnings: string[];
  features: string[];
}

export function analyzeGameCode(html: string): ValidationReport {
  const report: ValidationReport = {
    isValid: true,
    juiceScore: 0,
    errors: [],
    warnings: [],
    features: []
  };

  const check = (regex: RegExp, error: string, critical = true) => {
    if (!regex.test(html)) {
      if (critical) {
        report.isValid = false;
        report.errors.push(error);
      } else {
        report.warnings.push(error);
      }
      return false;
    }
    return true;
  };

  // 1. Technical Core (Critical)
  check(/touch-action:\s*none/i, "Missing 'touch-action: none' - necessary for Telegram WebView stability.");
  check(/try\s*\{[\s\S]*?localStorage[\s\S]*?\}\s*catch/i, "localStorage must be wrapped in try/catch to prevent SecurityError on iOS.");
  check(/requestAnimationFrame/i, "Must use requestAnimationFrame for a smooth 60fps game loop.");
  check(/pointerdown/i, "Missing 'pointerdown' event - required for mobile-first touch interaction.");
  check(/viewport[\s\S]*?user-scalable=no/i, "Viewport must prevent scaling for professional mobile feel.");

  // 2. Logic Structure
  check(/function\s+init\s*\(/, "Missing init() function.");
  check(/function\s+update\s*\(/, "Missing update() function.");
  check(/function\s+draw\s*\(/, "Missing draw() function.");

  // 3. Anti-Patterns
  if (/location\.reload\s*\(\)/.test(html)) {
    report.isValid = false;
    report.errors.push("FORBIDDEN: location.reload(). Use an internal reset() function instead.");
  }
  if (/<iframe/i.test(html)) {
    report.isValid = false;
    report.errors.push("FORBIDDEN: Nested iframes are not allowed.");
  }

  // 4. Juice & Visuals (Scoring)
  const juiceFeatures = [
    { regex: /shadowBlur|glow\s*\(/, name: "Neon Glow", score: 20 },
    { regex: /shake\s*=|shakeScreen/, name: "Screen Shake", score: 20 },
    { regex: /new\s+Part\(|particles/, name: "Particle System", score: 20 },
    { regex: /AudioContext|createOscillator/, name: "Procedural Audio", score: 20 },
    { regex: /translate\(|parallax/, name: "Parallax/Camera", score: 20 }
  ];

  let score = 0;
  juiceFeatures.forEach(f => {
    if (f.regex.test(html)) {
      score += f.score;
      report.features.push(f.name);
    }
  });

  // 5. Performance & Mobile
  if (html.length > 500000) { // 500kb
    report.warnings.push("File size is large (>500KB). Ensure you are not inlining heavy assets.");
  }

  report.juiceScore = score;
  if (score < 40) {
    report.warnings.push("Low Juice Score. Add more visual effects (glow, particles, shake).");
  }

  return report;
}
