/**
 * Professional Game Auto-Fixer
 * Automatically fixes common issues with up to 3 attempts
 * Version: 2.0 - Production Ready
 */

import { GameRequirementValidatorPro } from './gameRequirementValidatorPro';
import type { ValidationReport } from './gameRequirementValidatorPro';

export interface FixAttempt {
  attemptNumber: number;
  fixesApplied: string[];
  resultingCode: string;
  validationReport: ValidationReport;
  success: boolean;
}

export interface AutoFixResult {
  originalCode: string;
  fixedCode: string;
  attempts: FixAttempt[];
  totalAttempts: number;
  success: boolean;
  finalScore: number;
  message: string;
  suggestedManualFixes: string[];
}

export class GameAutoFixerPro {
  private gameId: string;
  private originalCode: string;
  private currentCode: string;
  private attempts: FixAttempt[] = [];
  private maxAttempts = 3;

  constructor(gameId: string, htmlCode: string) {
    this.gameId = gameId;
    // Ensure we always work with a complete HTML document
    if (!htmlCode.includes('<!DOCTYPE') && !htmlCode.includes('<html')) {
      htmlCode = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no"></head><body style="margin:0;overflow:hidden">${htmlCode}</body></html>`;
    }
    this.originalCode = htmlCode;
    this.currentCode = htmlCode;
  }

  /**
   * Auto-fix game with up to 3 attempts
   */
  async autoFix(): Promise<AutoFixResult> {
    this.attempts = [];

    for (let attemptNumber = 1; attemptNumber <= this.maxAttempts; attemptNumber++) {
      console.log(`Auto-fix attempt ${attemptNumber}/${this.maxAttempts}`);

      // Validate current code
      const validator = new GameRequirementValidatorPro(this.currentCode, this.gameId);
      const report = await validator.validate();

      // Get fixable issues
      const fixableIssues = report.allChecks.filter(
        check => check.canAutoFix && check.status !== 'pass'
      );

      if (fixableIssues.length === 0) {
        // No more fixable issues
        this.attempts.push({
          attemptNumber,
          fixesApplied: [],
          resultingCode: this.currentCode,
          validationReport: report,
          success: report.score >= 70,
        });

        if (report.score >= 70) {
          break; // Success!
        } else {
          // No more auto-fixes possible
          break;
        }
      }

      // Apply fixes
      const fixesApplied: string[] = [];

      for (const issue of fixableIssues) {
        const fixed = await this.applyFix(issue);
        if (fixed) {
          fixesApplied.push(issue.requirement);
        }
      }

      // Record attempt
      const newValidator = new GameRequirementValidatorPro(this.currentCode, this.gameId);
      const newReport = await newValidator.validate();

      this.attempts.push({
        attemptNumber,
        fixesApplied,
        resultingCode: this.currentCode,
        validationReport: newReport,
        success: newReport.score >= 70,
      });

      if (newReport.score >= 70) {
        break; // Success!
      }
    }

    return this.generateResult();
  }

  /**
   * Apply specific fix
   */
  private async applyFix(issue: any): Promise<boolean> {
    try {
      switch (issue.id) {
        case 4: // Portrait orientation
          this.fixPortraitOrientation();
          return true;

        case 10: // Game Over screen
          this.fixGameOverScreen();
          return true;

        case 18: // Font size
          this.fixFontSize();
          return true;

        case 20: // Sound after tap
          this.fixSoundAfterTap();
          return true;

        case 24: // Records saved
          this.fixRecordsSaving();
          return true;

        case 32: // Demo Mode
          this.fixDemoMode();
          return true;

        case 35: // Demo Mode parameter
          this.fixDemoModeParameter();
          return true;

        default:
          return false;
      }
    } catch (error) {
      console.error(`Error applying fix for ${issue.requirement}:`, error);
      return false;
    }
  }

  /**
   * Fix: Portrait orientation
   */
  private fixPortraitOrientation(): void {
    if (this.currentCode.includes('screen.orientation.lock')) return;

    const portraitLock = `
    // Enforce portrait orientation
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }
    `;

    this.injectBeforeScriptEnd(portraitLock);
  }

  /**
   * Fix: Game Over screen
   * Note: style has display:none and we use JS to toggle it via .style.display = 'flex'
   */
  private fixGameOverScreen(): void {
    if (this.currentCode.includes('gameOverScreen')) return;

    // Insert the overlay HTML before </body>
    const gameOverHTML = `
    <div id="gameOverScreen" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:9999;align-items:center;justify-content:center;">
      <div style="background:#1a1a2e;padding:40px 32px;border-radius:16px;text-align:center;max-width:300px;box-shadow:0 8px 32px rgba(0,0,0,0.5);">
        <h1 style="margin:0 0 16px;font-size:28px;color:#fff;">GAME OVER</h1>
        <p id="gameOverScore" style="font-size:22px;margin:0 0 8px;color:#a3b8d4;">Score: 0</p>
        <p id="gameOverReason" style="font-size:14px;margin:0 0 28px;color:#666;">Game ended</p>
        <button id="gameOverRestart" style="padding:12px 36px;font-size:16px;background:#a3b8d4;color:#0a0b0e;border:none;border-radius:12px;cursor:pointer;font-weight:700;">Play Again</button>
      </div>
    </div>
    `;
    this.injectBeforeBodyEnd(gameOverHTML);

    // Insert the showGameOver helper function
    const gameOverFunction = `
    function showGameOver(score, reason) {
      const scr = document.getElementById('gameOverScreen');
      if (!scr) return;
      const scoreEl = document.getElementById('gameOverScore');
      const reasonEl = document.getElementById('gameOverReason');
      if (scoreEl) scoreEl.textContent = 'Score: ' + score;
      if (reasonEl) reasonEl.textContent = reason || 'Game ended';
      scr.style.display = 'flex';
      const btn = document.getElementById('gameOverRestart');
      if (btn) btn.onclick = () => { scr.style.display = 'none'; location.reload(); };
    }
    `;
    if (!this.currentCode.includes('function showGameOver')) {
      this.injectBeforeScriptEnd(gameOverFunction);
    }
  }

  /**
   * Fix: Font size — inject min-font-size rule into existing style or add new <style>
   */
  private fixFontSize(): void {
    // Patch inline font-size values that are too small
    this.currentCode = this.currentCode.replace(/font-size:\s*(\d+)px/g, (_, size) => {
      const sizeNum = parseInt(size);
      return `font-size:${Math.max(sizeNum, 16)}px`;
    });

    // Inject a base font-size rule if none exists
    const hasBaseFont = /body\s*{[^}]*font-size/.test(this.currentCode);
    if (!hasBaseFont) {
      this.injectStyle('body { font-size: 16px; }');
    }
  }

  /**
   * Fix: Sound after tap
   */
  private fixSoundAfterTap(): void {
    if (this.currentCode.includes('audioInitialized')) return;

    const soundInit = `
    // Initialize audio on first tap
    let audioInitialized = false;
    function initAudio() {
      if (!audioInitialized) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          if (audioContext.state === 'suspended') audioContext.resume();
          audioInitialized = true;
        } catch (e) {}
      }
    }
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });
    `;
    this.injectBeforeScriptEnd(soundInit);
  }

  /**
   * Fix: Records saving
   */
  private fixRecordsSaving(): void {
    if (this.currentCode.includes('function saveRecord')) return;

    const recordsCode = `
    function saveRecord(key, value) {
      try { localStorage.setItem('sg_' + key, JSON.stringify(value)); } catch (e) {}
    }
    function loadRecord(key, defaultValue) {
      try { const v = localStorage.getItem('sg_' + key); return v !== null ? JSON.parse(v) : defaultValue; } catch (e) { return defaultValue; }
    }
    `;
    this.injectBeforeScriptEnd(recordsCode);
  }

  /**
   * Fix: Demo Mode
   */
  private fixDemoMode(): void {
    if (this.currentCode.includes('isDemo') || this.currentCode.includes('demoMode')) return;

    const demoCode = `
    const isDemo = new URLSearchParams(location.search).get('demo') === '1';
    if (isDemo) { console.log('[SmolGame] Demo Mode active'); }
    function startDemoMode() { /* Customize: auto-perform game actions for demo */ }
    if (isDemo) setTimeout(startDemoMode, 500);
    `;
    this.injectBeforeScriptEnd(demoCode);
  }

  /**
   * Fix: Demo Mode parameter (URLSearchParams)
   */
  private fixDemoModeParameter(): void {
    if (this.currentCode.includes('URLSearchParams')) return;

    const paramCode = `
    const _urlParams = new URLSearchParams(location.search);
    const demoMode = _urlParams.get('demo') === '1';
    `;
    this.injectAtScriptStart(paramCode);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // Safe injection helpers
  // ────────────────────────────────────────────────────────────────────────────

  /** Insert code before the LAST </script> tag */
  private injectBeforeScriptEnd(code: string): void {
    const idx = this.currentCode.lastIndexOf('</script>');
    if (idx !== -1) {
      this.currentCode = this.currentCode.slice(0, idx) + code + this.currentCode.slice(idx);
    } else {
      // No script tag at all: wrap in one and append before </body>
      this.injectBeforeBodyEnd(`<script>${code}</script>`);
    }
  }

  /** Insert code at the start of the FIRST <script> tag body */
  private injectAtScriptStart(code: string): void {
    const idx = this.currentCode.indexOf('<script>');
    if (idx !== -1) {
      const insertAt = idx + '<script>'.length;
      this.currentCode = this.currentCode.slice(0, insertAt) + code + this.currentCode.slice(insertAt);
    } else {
      this.injectBeforeBodyEnd(`<script>${code}</script>`);
    }
  }

  /** Insert HTML before </body> */
  private injectBeforeBodyEnd(html: string): void {
    const idx = this.currentCode.lastIndexOf('</body>');
    if (idx !== -1) {
      this.currentCode = this.currentCode.slice(0, idx) + html + this.currentCode.slice(idx);
    } else {
      this.currentCode += html;
    }
  }

  /** Add a CSS rule into an existing <style> or create a new <style> before </head> */
  private injectStyle(css: string): void {
    const existingStyle = this.currentCode.lastIndexOf('</style>');
    if (existingStyle !== -1) {
      this.currentCode = this.currentCode.slice(0, existingStyle) + '\n' + css + '\n' + this.currentCode.slice(existingStyle);
    } else {
      const headEnd = this.currentCode.lastIndexOf('</head>');
      if (headEnd !== -1) {
        this.currentCode = this.currentCode.slice(0, headEnd) + `<style>${css}</style>` + this.currentCode.slice(headEnd);
      } else {
        this.currentCode = `<style>${css}</style>` + this.currentCode;
      }
    }
  }

  /**
   * Generate result
   */
  private generateResult(): AutoFixResult {
    const lastAttempt = this.attempts[this.attempts.length - 1];
    const success = lastAttempt?.success || false;
    const finalScore = lastAttempt?.validationReport.score || 0;

    const suggestedManualFixes: string[] = [];

    if (lastAttempt?.validationReport) {
      lastAttempt.validationReport.allChecks.forEach(check => {
        if (check.status !== 'pass' && check.priority === 'critical') {
          suggestedManualFixes.push(`${check.requirement}: ${check.suggestion || check.message}`);
        }
      });
    }

    const message = success
      ? `✅ Auto-fix successful! Score: ${finalScore}/100`
      : `⚠️ Auto-fix completed but score is ${finalScore}/100. Manual fixes needed.`;

    return {
      originalCode: this.originalCode,
      fixedCode: this.currentCode,
      attempts: this.attempts,
      totalAttempts: this.attempts.length,
      success,
      finalScore,
      message,
      suggestedManualFixes,
    };
  }
}

/**
 * Quick auto-fix function
 */
export async function autoFixGame(
  gameId: string,
  htmlCode: string
): Promise<AutoFixResult> {
  const fixer = new GameAutoFixerPro(gameId, htmlCode);
  return await fixer.autoFix();
}
