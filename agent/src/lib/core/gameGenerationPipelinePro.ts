/**
 * Professional Game Generation Pipeline
 * Complete workflow with validation, testing, and quality gates
 * Version: 2.0 - Production Ready
 */

import type { ValidationReport } from './gameRequirementValidatorPro';
import { GameRequirementValidatorPro } from './gameRequirementValidatorPro';
import type { GameTestReport } from './gameTestingFrameworkPro';
import { GameTestingFrameworkPro } from './gameTestingFrameworkPro';
import type { AutoFixResult } from './gameAutoFixerPro';
import { GameAutoFixerPro } from './gameAutoFixerPro';

export type PipelinePhase =
  | 'generation'
  | 'validation'
  | 'auto_fix'
  | 'testing'
  | 'quality_gate'
  | 'deployment'
  | 'complete'
  | 'failed';

export interface PipelineStep {
  phase: PipelinePhase;
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  startTime: Date;
  endTime?: Date;
  duration?: number;
  result?: any;
  error?: string;
}

export interface PipelineResult {
  gameId: string;
  timestamp: Date;
  phases: PipelineStep[];
  currentPhase: PipelinePhase;
  isSuccess: boolean;
  isPublishable: boolean;
  finalScore: number;
  generatedCode: string;
  validationReport?: ValidationReport;
  testReport?: GameTestReport;
  autoFixResult?: AutoFixResult;
  qualityGateResult?: QualityGateResult;
  summary: string;
  nextSteps: string[];
  errors: string[];
}

export interface QualityGateResult {
  hardGates: GateCheck[];
  softGates: GateCheck[];
  allPassed: boolean;
  score: number;
}

export interface GateCheck {
  name: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  critical: boolean;
}

export class GameGenerationPipelinePro {
  private gameId: string;
  private gameCode: string;
  private phases: PipelineStep[] = [];
  private callbacks: PipelineCallbacks;
  private errors: string[] = [];

  constructor(
    gameId: string,
    gameCode: string,
    callbacks: PipelineCallbacks = {}
  ) {
    this.gameId = gameId;
    this.gameCode = gameCode;
    this.callbacks = callbacks;
  }

  /**
   * Run complete pipeline
   */
  async run(): Promise<PipelineResult> {
    this.phases = [];
    this.errors = [];

    try {
      // Phase 1: Validation
      await this.runPhase('validation', () => this.validate());

      // Phase 2: Auto-fix (if needed)
      const validationResult = this.getPhaseResult('validation') as ValidationReport;
      if (validationResult.score < 70) {
        await this.runPhase('auto_fix', () => this.autoFix());
      }

      // Phase 3: Testing
      await this.runPhase('testing', () => this.test());

      // Phase 4: Quality Gate
      await this.runPhase('quality_gate', () => this.qualityGate());

      // Phase 5: Deployment (if passed)
      const qualityResult = this.getPhaseResult('quality_gate') as QualityGateResult;
      if (qualityResult.allPassed) {
        await this.runPhase('deployment', () => this.deploy());
      }

      // Mark complete
      this.addPhase('complete', 'complete', {});
    } catch (error) {
      this.addError(String(error));
      this.addPhase('failed', 'failed', { error: String(error) });
    }

    return this.generateResult();
  }

  /**
   * Phase 1: Validation
   */
  private async validate(): Promise<ValidationReport> {
    this.notify('Validating game against 35 requirements...');

    const validator = new GameRequirementValidatorPro(this.gameCode, this.gameId);
    const report = await validator.validate();

    this.notify(`Validation complete. Score: ${report.score}/100`);

    if (report.failed > 0) {
      this.notify(`Found ${report.failed} critical failures`);
      report.criticalFailures.forEach(failure => {
        this.notify(`  ❌ ${failure.requirement}: ${failure.message}`);
      });
    }

    return report;
  }

  /**
   * Phase 2: Auto-fix
   */
  private async autoFix(): Promise<AutoFixResult> {
    this.notify('Attempting to auto-fix issues...');

    const fixer = new GameAutoFixerPro(this.gameId, this.gameCode);
    const result = await fixer.autoFix();

    this.notify(`Auto-fix attempts: ${result.totalAttempts}`);
    this.notify(`Final score: ${result.finalScore}/100`);

    if (result.success) {
      this.gameCode = result.fixedCode;
      this.notify('✅ Auto-fix successful!');
    } else {
      this.notify('⚠️ Auto-fix incomplete. Manual fixes needed:');
      result.suggestedManualFixes.forEach(fix => {
        this.notify(`  - ${fix}`);
      });
    }

    return result;
  }

  /**
   * Phase 3: Testing
   */
  private async test(): Promise<GameTestReport> {
    this.notify('Running sandbox tests...');

    const tester = new GameTestingFrameworkPro(this.gameId, this.gameCode);
    const report = await tester.runAllTests();

    this.notify(`Tests completed: ${report.passed}/${report.totalTests} passed`);

    if (report.failed > 0) {
      this.notify(`⚠️ ${report.failed} tests failed`);
    }

    this.notify(`Performance: ${report.performance.averageFPS} FPS, ${report.performance.loadTime.toFixed(0)}ms load`);

    return report;
  }

  /**
   * Phase 4: Quality Gate
   */
  private async qualityGate(): Promise<QualityGateResult> {
    this.notify('Running quality gates...');

    const validationReport = this.getPhaseResult('validation') as ValidationReport;
    const testReport = this.getPhaseResult('testing') as GameTestReport;

    const hardGates: GateCheck[] = [
      {
        name: 'No backend calls',
        status: validationReport.allChecks.find(c => c.id === 1)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must be static-only',
        critical: true,
      },
      {
        name: 'Works in iframe',
        status: validationReport.allChecks.find(c => c.id === 2)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must work in iframe',
        critical: true,
      },
      {
        name: 'Touch controls',
        status: validationReport.allChecks.find(c => c.id === 3)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must have touch controls',
        critical: true,
      },
      {
        name: 'Portrait orientation',
        status: validationReport.allChecks.find(c => c.id === 4)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must be portrait-only',
        critical: true,
      },
      {
        name: 'No system dialogs',
        status: validationReport.allChecks.find(c => c.id === 5)?.status === 'pass' ? 'pass' : 'fail',
        message: 'No alert/confirm/prompt allowed',
        critical: true,
      },
      {
        name: 'Demo Mode works',
        status: validationReport.allChecks.find(c => c.id === 32)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must have working demo mode',
        critical: true,
      },
      {
        name: 'Game Over screen',
        status: validationReport.allChecks.find(c => c.id === 10)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must have Game Over screen',
        critical: true,
      },
      {
        name: 'localStorage support',
        status: validationReport.allChecks.find(c => c.id === 24)?.status === 'pass' ? 'pass' : 'fail',
        message: 'Game must save records to localStorage',
        critical: true,
      },
      {
        name: 'No JS errors',
        status: testReport.failed === 0 ? 'pass' : 'fail',
        message: 'Game must run without errors',
        critical: true,
      },
      {
        name: 'Playable',
        status: testReport.isPlayable ? 'pass' : 'fail',
        message: 'Game must be playable',
        critical: true,
      },
    ];

    const softGates: GateCheck[] = [
      {
        name: 'Good performance',
        status: testReport.performance.averageFPS >= 30 ? 'pass' : 'warning',
        message: 'Game should run at 30+ FPS',
        critical: false,
      },
      {
        name: 'Fast loading',
        status: testReport.performance.loadTime < 2000 ? 'pass' : 'warning',
        message: 'Game should load in <2 seconds',
        critical: false,
      },
      {
        name: 'Low memory',
        status: testReport.performance.memoryUsage < 10 * 1024 * 1024 ? 'pass' : 'warning',
        message: 'Game should use <10MB memory',
        critical: false,
      },
      {
        name: 'Instant action',
        status: validationReport.allChecks.find(c => c.id === 9)?.status === 'pass' ? 'pass' : 'warning',
        message: 'Something should happen in first 3 seconds',
        critical: false,
      },
      {
        name: 'Good contrast',
        status: validationReport.allChecks.find(c => c.id === 19)?.status === 'pass' ? 'pass' : 'warning',
        message: 'Text should be readable in bright light',
        critical: false,
      },
    ];

    const hardGatesPassed = hardGates.filter(g => g.status === 'pass').length;
    const softGatesPassed = softGates.filter(g => g.status === 'pass').length;
    const allPassed = hardGates.every(g => g.status === 'pass');
    const score = Math.round(
      (hardGatesPassed / hardGates.length) * 70 +
      (softGatesPassed / softGates.length) * 30
    );

    this.notify(`Hard gates: ${hardGatesPassed}/${hardGates.length} passed`);
    this.notify(`Soft gates: ${softGatesPassed}/${softGates.length} passed`);
    this.notify(`Quality score: ${score}/100`);

    if (!allPassed) {
      this.notify('❌ Quality gate failed. Cannot deploy.');
      hardGates.filter(g => g.status === 'fail').forEach(gate => {
        this.notify(`  ❌ ${gate.name}: ${gate.message}`);
      });
    } else {
      this.notify('✅ All quality gates passed!');
    }

    return { hardGates, softGates, allPassed, score };
  }

  /**
   * Phase 5: Deployment
   */
  private async deploy(): Promise<{ success: boolean; message: string }> {
    this.notify('Preparing for deployment...');

    // This would be implemented by the caller
    // For now, just mark as ready

    return {
      success: true,
      message: 'Ready for deployment',
    };
  }

  /**
   * Run phase with error handling
   */
  private async runPhase(
    phase: PipelinePhase,
    fn: () => Promise<any>
  ): Promise<void> {
    const step: PipelineStep = {
      phase,
      status: 'in_progress',
      startTime: new Date(),
    };

    this.phases.push(step);
    this.notify(`Starting phase: ${phase}`);

    try {
      const result = await fn();
      step.status = 'complete';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - step.startTime.getTime();
      step.result = result;

      this.notify(`✅ Phase complete: ${phase} (${step.duration}ms)`);
    } catch (error) {
      step.status = 'failed';
      step.endTime = new Date();
      step.duration = step.endTime.getTime() - step.startTime.getTime();
      step.error = String(error);

      this.notify(`❌ Phase failed: ${phase}`);
      this.addError(`${phase}: ${error}`);
      throw error;
    }
  }

  /**
   * Add phase
   */
  private addPhase(
    phase: PipelinePhase,
    status: 'pending' | 'in_progress' | 'complete' | 'failed',
    result: any
  ): void {
    this.phases.push({
      phase,
      status,
      startTime: new Date(),
      result,
    });
  }

  /**
   * Get phase result
   */
  private getPhaseResult(phase: PipelinePhase): any {
    const step = this.phases.find(p => p.phase === phase);
    return step?.result;
  }

  /**
   * Add error
   */
  private addError(error: string): void {
    this.errors.push(error);
  }

  /**
   * Notify callback
   */
  private notify(message: string): void {
    if (this.callbacks.onProgress) {
      this.callbacks.onProgress(message);
    }
    console.log(`[Pipeline] ${message}`);
  }

  /**
   * Generate result
   */
  private generateResult(): PipelineResult {
    const validationReport = this.getPhaseResult('validation') as ValidationReport;
    const testReport = this.getPhaseResult('testing') as GameTestReport;
    const autoFixResult = this.getPhaseResult('auto_fix') as AutoFixResult;
    const qualityResult = this.getPhaseResult('quality_gate') as QualityGateResult;

    const lastPhase = this.phases[this.phases.length - 1];
    const isSuccess = lastPhase?.status === 'complete';
    const isPublishable = qualityResult?.allPassed || false;
    const finalScore = qualityResult?.score || validationReport?.score || 0;

    const summary = `
Game Generation Pipeline Report
${new Date().toLocaleString()}

Game ID: ${this.gameId}
Status: ${isSuccess ? '✅ SUCCESS' : '❌ FAILED'}
Publishable: ${isPublishable ? '✅ YES' : '❌ NO'}
Final Score: ${finalScore}/100

Phases:
${this.phases.map(p => `  ${p.phase}: ${p.status} (${p.duration}ms)`).join('\n')}

${this.errors.length > 0
        ? `Errors:\n${this.errors.map(e => `  - ${e}`).join('\n')}`
        : 'No errors'
      }
    `.trim();

    const nextSteps: string[] = [];

    if (!isSuccess) {
      nextSteps.push('Fix errors and try again');
    } else if (!isPublishable) {
      nextSteps.push('Address quality gate failures');
      if (qualityResult) {
        qualityResult.hardGates
          .filter(g => g.status === 'fail')
          .forEach(g => {
            nextSteps.push(`  - ${g.name}: ${g.message}`);
          });
      }
    } else {
      nextSteps.push('✅ Ready to deploy!');
    }

    return {
      gameId: this.gameId,
      timestamp: new Date(),
      phases: this.phases,
      currentPhase: (lastPhase?.phase || 'failed') as PipelinePhase,
      isSuccess,
      isPublishable,
      finalScore,
      generatedCode: this.gameCode,
      validationReport,
      testReport,
      autoFixResult,
      qualityGateResult: qualityResult,
      summary,
      nextSteps,
      errors: this.errors,
    };
  }
}

export interface PipelineCallbacks {
  onProgress?: (message: string) => void;
  onPhaseComplete?: (phase: PipelinePhase, result: any) => void;
  onError?: (error: string) => void;
}

/**
 * Quick pipeline function
 */
export async function runGamePipeline(
  gameId: string,
  gameCode: string,
  callbacks?: PipelineCallbacks
): Promise<PipelineResult> {
  const pipeline = new GameGenerationPipelinePro(gameId, gameCode, callbacks);
  return await pipeline.run();
}
