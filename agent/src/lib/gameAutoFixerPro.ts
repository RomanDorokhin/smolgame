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
    const portraitLock = `
    // Enforce portrait orientation
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(err => console.log('Orientation lock failed:', err));
    }
    `;

    if (!this.currentCode.includes('screen.orientation.lock')) {
      const scriptEnd = this.currentCode.lastIndexOf('</script>');
      if (scriptEnd !== -1) {
        this.currentCode =
          this.currentCode.slice(0, scriptEnd) +
          portraitLock +
          this.currentCode.slice(scriptEnd);
      }
    }
  }

  /**
   * Fix: Game Over screen
   */
  private fixGameOverScreen(): void {
    const gameOverHTML = `
    <div id="gameOverScreen" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:1000;display:flex;align-items:center;justify-content:center;">
      <div style="background:white;padding:40px;border-radius:10px;text-align:center;max-width:300px;">
        <h1 style="margin:0 0 20px;font-size:32px;">GAME OVER</h1>
        <p id="gameOverScore" style="font-size:24px;margin:0 0 20px;">Score: 0</p>
        <p id="gameOverReason" style="font-size:16px;margin:0 0 30px;color:#666;">Game ended</p>
        <button id="gameOverRestart" style="padding:10px 30px;font-size:16px;background:#4CAF50;color:white;border:none;border-radius:5px;cursor:pointer;">Play Again</button>
      </div>
    </div>
    `;

    if (!this.currentCode.includes('gameOverScreen')) {
      const bodyEnd = this.currentCode.lastIndexOf('</body>');
      if (bodyEnd !== -1) {
        this.currentCode =
          this.currentCode.slice(0, bodyEnd) +
          gameOverHTML +
          this.currentCode.slice(bodyEnd);
      }
    }

    // Add game over function if not exists
    if (!this.currentCode.includes('function showGameOver')) {
      const scriptEnd = this.currentCode.lastIndexOf('</script>');
      if (scriptEnd !== -1) {
        const gameOverFunction = `
        function showGameOver(score, reason) {
          const screen = document.getElementById('gameOverScreen');
          if (screen) {
            document.getElementById('gameOverScore').textContent = 'Score: ' + score;
            document.getElementById('gameOverReason').textContent = reason || 'Game ended';
            screen.style.display = 'flex';
            document.getElementById('gameOverRestart').onclick = () => {
              screen.style.display = 'none';
              location.reload();
            };
          }
        }
        `;

        this.currentCode =
          this.currentCode.slice(0, scriptEnd) +
          gameOverFunction +
          this.currentCode.slice(scriptEnd);
      }
    }
  }

  /**
   * Fix: Font size
   */
  private fixFontSize(): void {
    // Replace small fonts with minimum 16px
    this.currentCode = this.currentCode.replace(/font-size:\s*(\d+)px/g, (_, size) => {
      const sizeNum = parseInt(size);
      return `font-size:${Math.max(sizeNum, 16)}px`;
    });

    // Add base font size if not exists
    if (!this.currentCode.includes('body {') && !this.currentCode.includes('<style>')) {
      const headEnd = this.currentCode.lastIndexOf('</head>');
      if (headEnd !== -1) {
        const style = `<style>body { font-size: 16px; }</style>`;
        this.currentCode =
          this.currentCode.slice(0, headEnd) +
          style +
          this.currentCode.slice(headEnd);
      }
    }
  }

  /**
   * Fix: Sound after tap
   */
  private fixSoundAfterTap(): void {
    const soundInit = `
    // Initialize audio on first tap
    let audioInitialized = false;
    
    function initAudio() {
      if (!audioInitialized) {
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          audioInitialized = true;
          console.log('Audio initialized');
        } catch (e) {
          console.log('Audio context not supported');
        }
      }
    }
    
    // Listen for first tap
    document.addEventListener('touchstart', initAudio, { once: true });
    document.addEventListener('click', initAudio, { once: true });
    `;

    if (!this.currentCode.includes('audioInitialized')) {
      const scriptEnd = this.currentCode.lastIndexOf('</script>');
      if (scriptEnd !== -1) {
        this.currentCode =
          this.currentCode.slice(0, scriptEnd) +
          soundInit +
          this.currentCode.slice(scriptEnd);
      }
    }
  }

  /**
   * Fix: Records saving
   */
  private fixRecordsSaving(): void {
    const recordsCode = `
    // Save and load records
    function saveRecord(key, value) {
      try {
        localStorage.setItem('game_' + key, JSON.stringify(value));
      } catch (e) {
        console.log('localStorage not available');
      }
    }
    
    function loadRecord(key, defaultValue) {
      try {
        const value = localStorage.getItem('game_' + key);
        return value ? JSON.parse(value) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    }
    
    // Example usage:
    // saveRecord('bestScore', 1000);
    // const bestScore = loadRecord('bestScore', 0);
    `;

    if (!this.currentCode.includes('function saveRecord')) {
      const scriptEnd = this.currentCode.lastIndexOf('</script>');
      if (scriptEnd !== -1) {
        this.currentCode =
          this.currentCode.slice(0, scriptEnd) +
          recordsCode +
          this.currentCode.slice(scriptEnd);
      }
    }
  }

  /**
   * Fix: Demo Mode
   */
  private fixDemoMode(): void {
    const demoCode = `
    // Demo mode detection
    const isDemo = new URLSearchParams(location.search).get('demo') === '1';
    
    if (isDemo) {
      console.log('Running in Demo Mode');
      // Auto-play game without user interaction
      startDemoMode();
    }
    
    function startDemoMode() {
      // Auto-play game
      // Example: automatically perform actions
      // This should be customized for your game
    }
    `;

    if (!this.currentCode.includes('isDemo')) {
      const scriptEnd = this.currentCode.lastIndexOf('</script>');
      if (scriptEnd !== -1) {
        this.currentCode =
          this.currentCode.slice(0, scriptEnd) +
          demoCode +
          this.currentCode.slice(scriptEnd);
      }
    }
  }

  /**
   * Fix: Demo Mode parameter
   */
  private fixDemoModeParameter(): void {
    const paramCode = `
    // Check for demo parameter
    const urlParams = new URLSearchParams(location.search);
    const demoMode = urlParams.get('demo') === '1';
    `;

    if (!this.currentCode.includes('URLSearchParams')) {
      const scriptStart = this.currentCode.indexOf('<script>') + 8;
      if (scriptStart > 7) {
        this.currentCode =
          this.currentCode.slice(0, scriptStart) +
          paramCode +
          this.currentCode.slice(scriptStart);
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
