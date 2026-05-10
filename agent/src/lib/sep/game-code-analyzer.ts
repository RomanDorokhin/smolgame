/**
 * SEP Enforcer: Game Code Analyzer for SmolGame Engine Pipeline (SEP)
 * Provides robust static analysis to enforce security, quality, and Smol-Core integration standards.
 * This enforcer acts as a gatekeeper, ensuring generated games meet production-level requirements.
 */

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  juiceScore: number;
  securityScore: number;
  smolCoreIntegrationScore: number;
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
    errors: [],
    warnings: [],
    juiceScore: 0,
    securityScore: 100, // Start with perfect score, deduct for violations
    smolCoreIntegrationScore: 0
  };

  // Extract JS from script tags for syntax check
  const scripts = htmlContent.match(/<script[\s\S]*?>([\s\S]*?)<\/script>/g) || [];
  scripts.forEach(s => {
    const code = s.replace(/<script[\s\S]*?>|<\/script>/g, '');
    const syntaxError = validateSyntax(code);
    if (syntaxError) {
      report.isValid = false;
      report.errors.push(`JS Syntax Error: ${syntaxError}`);
    }
  });

  if (!htmlContent) {
    report.isValid = false;
    report.errors.push("HTML content is empty.");
    return report;
  }

  // --- 1. Security Checks (Code Sandboxing Enforcement) ---
  const blockedPatterns = [
    { regex: /eval\s*\(/g, name: "eval()", scoreDeduction: 50 },
    { regex: /new\s+Function\s*\(/g, name: "new Function()", scoreDeduction: 50 },
    { regex: /document\.write\s*\(/g, name: "document.write()", scoreDeduction: 30 },
    { regex: /XMLHttpRequest|fetch\s*\(/g, name: "Network requests (XMLHttpRequest/fetch)", scoreDeduction: 20 }, // Allow only via Smol.Assets
    { regex: /window\.parent/g, name: "window.parent", scoreDeduction: 40 },
    { regex: /window\.top/g, name: "window.top", scoreDeduction: 40 },
    { regex: /window\.opener/g, name: "window.opener", scoreDeduction: 40 },
    { regex: /document\.cookie/g, name: "document.cookie", scoreDeduction: 30 },
    { regex: /window\.location/g, name: "window.location", scoreDeduction: 20 },
    { regex: /localStorage\.setItem|localStorage\.getItem|localStorage\.removeItem|localStorage\.clear/g, name: "Direct localStorage access", scoreDeduction: 15 } // Must use Smol.Storage
  ];

  blockedPatterns.forEach(pattern => {
    if (pattern.regex.test(htmlContent)) {
      report.isValid = false;
      report.errors.push(`Security violation: Usage of blocked API/pattern '${pattern.name}' is not allowed. Use Smol-Core abstractions.`);
      report.securityScore -= pattern.scoreDeduction;
    }
  });
  if (report.securityScore < 0) report.securityScore = 0;

  // --- 2. Smol-Core Integration Checks ---
  let smolCoreFound = false;
  if (htmlContent.includes("smol-core.js")) {
    report.smolCoreIntegrationScore += 20;
    smolCoreFound = true;
  } else {
    report.errors.push("Smol-Core script tag not found. Games must include smol-core.js.");
    report.isValid = false;
  }
  
  if (/Smol\.init\s*\(/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 20;
  } else {
    report.errors.push("Missing Smol.init(). The game must initialize Smol-Core.");
    report.isValid = false;
  }

  if (/Smol\.State\.set\s*\(/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 15;
  } else {
    report.warnings.push("Smol.State.set() not found. Ensure proper game state management.");
  }

  if (/Smol\.Storage\.(set|get|remove|clear)\s*\(/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 15;
  } else {
    report.warnings.push("Smol.Storage not used. Direct localStorage access is discouraged and will be blocked.");
  }

  if (/Smol\.Input\.bind\s*\(/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 15;
  } else {
    report.warnings.push("Smol.Input.bind() not found. Ensure unified input handling for mobile/desktop.");
  }

  if (/Smol\.Audio\.(tone|sfx|playMusic)\s*\(/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 15;
  } else {
    report.warnings.push("Smol.Audio not used. Games should have sound effects and music.");
  }

  // --- 3. Juice / Quality Metrics (Juice Score) ---
  // Particles
  if (/Smol\.Effects\.burst/.test(htmlContent) && /Smol\.Effects\.updateParticles/.test(htmlContent)) {
    report.juiceScore += 20;
  } else {
    report.warnings.push("Particle effects (Smol.Effects.burst/updateParticles) not detected. Add for more juice.");
  }

  // Screen Shake
  if (/Smol\.Effects\.shakeScreen/.test(htmlContent)) {
    report.juiceScore += 15;
  } else {
    report.warnings.push("Screen shake (Smol.Effects.shakeScreen) not detected. Add for impact.");
  }

  // Parallax
  if (/Smol\.Effects\.addParallaxLayer/.test(htmlContent) && /Smol\.Effects\.renderParallax/.test(htmlContent)) {
    report.juiceScore += 20;
  } else {
    report.warnings.push("Parallax background (Smol.Effects.addParallaxLayer/renderParallax) not detected. Add for depth.");
  }

  // Glow effects
  if (/Smol\.Render\.gl/.test(htmlContent)) {
    report.juiceScore += 10;
  } else {
    report.warnings.push("Glow effects (Smol.Render.gl) not detected. Add for visual polish.");
  }

  // Post-processing (Vignette, Scanlines)
  if (/Smol\.Render\.(vignette|scanlines)/.test(htmlContent)) {
    report.juiceScore += 10;
  } else {
    report.warnings.push("Post-processing effects (Smol.Render.vignette/scanlines) not detected. Add for atmosphere.");
  }

  // Text rendering with glow
  if (/Smol\.Render\.text/.test(htmlContent)) {
    report.juiceScore += 5;
  } else {
    report.warnings.push("Smol.Render.text for HUD/scores not used. Consider for better UI.");
  }

  // --- 4. Social SDK Integration ---
  if (/Smol\.Social\.submitScore/.test(htmlContent)) {
    report.juiceScore += 5; // Part of overall quality
    report.smolCoreIntegrationScore += 10;
  } else {
    report.warnings.push("Smol.Social.submitScore not used. Games should integrate with leaderboards.");
  }
  if (/Smol\.Social\.(shareGame|inviteFriends)/.test(htmlContent)) {
    report.juiceScore += 5; // Part of overall quality
    report.smolCoreIntegrationScore += 5;
  } else {
    report.warnings.push("Smol.Social.shareGame/inviteFriends not used. Encourage social sharing.");
  }

  // --- 5. Asset Pipeline Integration ---
  if (/Smol\.Assets\.(loadImage|loadAudio|generateImage|generateAudio)/.test(htmlContent)) {
    report.smolCoreIntegrationScore += 10;
  } else {
    report.warnings.push("Smol.Assets not used for loading/generating assets. Ensure proper asset management.");
  }

  // Final check for overall quality
  if (report.juiceScore < 70) {
    report.warnings.push("Overall Juice Score is low. Game might lack visual and audio polish.");
  }
  if (report.smolCoreIntegrationScore < 80 && smolCoreFound) {
    report.warnings.push("Smol-Core is included but not fully utilized. Leverage more Smol-Core features.");
  }

  if (report.errors.length > 0) {
    report.isValid = false;
  }

  return report;
}
