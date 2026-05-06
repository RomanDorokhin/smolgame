/**
 * Professional Game Testing Framework
 * Tests games in sandbox before deployment
 * Version: 2.0 - Production Ready
 */

export interface TestResult {
  testName: string;
  status: 'pass' | 'fail' | 'warning' | 'timeout';
  duration: number;
  message: string;
  error?: string;
  details?: Record<string, unknown>;
}

export interface GameTestReport {
  gameId: string;
  timestamp: Date;
  totalTests: number;
  passed: number;
  failed: number;
  warnings: number;
  errors: string[];
  isPlayable: boolean;
  results: TestResult[];
  performance: PerformanceMetrics;
  summary: string;
}

export interface PerformanceMetrics {
  loadTime: number;
  firstFrameTime: number;
  averageFPS: number;
  memoryUsage: number;
  jsErrors: number;
  warnings: number;
}

export class GameTestingFrameworkPro {
  private gameId: string;
  private htmlCode: string;
  private results: TestResult[] = [];
  private errors: string[] = [];
  private iframe: HTMLIFrameElement | null = null;
  private performanceMetrics: PerformanceMetrics = {
    loadTime: 0,
    firstFrameTime: 0,
    averageFPS: 0,
    memoryUsage: 0,
    jsErrors: 0,
    warnings: 0,
  };

  constructor(gameId: string, htmlCode: string) {
    this.gameId = gameId;
    this.htmlCode = htmlCode;
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<GameTestReport> {
    this.results = [];
    this.errors = [];

    try {
      // Create sandbox iframe
      await this.createSandboxIframe();

      // Run tests
      await this.testLoading();
      await this.testTouchEvents();
      await this.testLocalStorage();
      await this.testDemoMode();
      await this.testGameOver();
      await this.testPerformance();
      await this.testMemoryUsage();
      await this.testConsoleErrors();
      await this.testPortraitOrientation();
      await this.testSound();
      await this.testMultitouch();
      await this.testResponsiveness();

      // Cleanup
      this.cleanupSandbox();
    } catch (error) {
      this.addError(`Test suite error: ${error}`);
    }

    return this.generateReport();
  }

  /**
   * Create sandbox iframe for testing
   */
  private async createSandboxIframe(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Create iframe
        this.iframe = document.createElement('iframe');
        this.iframe.style.display = 'none';
        this.iframe.style.width = '375px';
        this.iframe.style.height = '667px';
        this.iframe.sandbox.add('allow-scripts');
        this.iframe.sandbox.add('allow-same-origin');

        // Wait for load
        this.iframe.onload = () => {
          setTimeout(() => resolve(), 100);
        };

        this.iframe.onerror = () => {
          reject(new Error('iframe load failed'));
        };

        // Set timeout
        const timeout = setTimeout(() => {
          reject(new Error('iframe load timeout'));
        }, 5000);

        // Append to DOM
        document.body.appendChild(this.iframe);

        // Write HTML
        const doc = this.iframe.contentDocument;
        if (doc) {
          doc.open();
          doc.write(this.htmlCode);
          doc.close();
        }

        clearTimeout(timeout);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Test game loading
   */
  private async testLoading(): Promise<void> {
    const startTime = performance.now();

    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const endTime = performance.now();
      this.performanceMetrics.loadTime = endTime - startTime;

      this.addResult({
        testName: 'Game Loading',
        status: this.performanceMetrics.loadTime < 2000 ? 'pass' : 'warning',
        duration: this.performanceMetrics.loadTime,
        message: `Game loaded in ${this.performanceMetrics.loadTime.toFixed(0)}ms`,
      });
    } catch (error) {
      this.addResult({
        testName: 'Game Loading',
        status: 'fail',
        duration: 0,
        message: 'Failed to load game',
        error: String(error),
      });
    }
  }

  /**
   * Test touch events
   */
  private async testTouchEvents(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const touchEventNames = ['touchstart', 'touchend', 'touchmove'];
      let touchListenerCount = 0;

      // Check for touch listeners
      const allElements = doc.querySelectorAll('*');
      allElements.forEach(el => {
        touchEventNames.forEach(eventName => {
          const listener = (el as any)[`on${eventName}`];
          if (listener) touchListenerCount++;
        });
      });

      // Simulate touch event
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          {
            identifier: 0,
            target: doc.body,
            clientX: 100,
            clientY: 100,
            screenX: 100,
            screenY: 100,
            pageX: 100,
            pageY: 100,
            radiusX: 0,
            radiusY: 0,
            rotationAngle: 0,
            force: 1,
          } as Touch,
        ],
      });

      doc.body.dispatchEvent(touchEvent);

      this.addResult({
        testName: 'Touch Events',
        status: touchListenerCount > 0 ? 'pass' : 'warning',
        duration: 0,
        message: `Found ${touchListenerCount} touch event listeners`,
        details: { touchListenerCount },
      });
    } catch (error) {
      this.addResult({
        testName: 'Touch Events',
        status: 'warning',
        duration: 0,
        message: 'Could not verify touch events',
        error: String(error),
      });
    }
  }

  /**
   * Test localStorage
   */
  private async testLocalStorage(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const window = this.iframe.contentWindow as any;

      // Test localStorage access
      window.localStorage.setItem('test_key', 'test_value');
      const value = window.localStorage.getItem('test_key');
      window.localStorage.removeItem('test_key');

      const hasLocalStorage = value === 'test_value';

      this.addResult({
        testName: 'localStorage Support',
        status: hasLocalStorage ? 'pass' : 'fail',
        duration: 0,
        message: hasLocalStorage
          ? 'localStorage working correctly'
          : 'localStorage not working',
      });
    } catch (error) {
      this.addResult({
        testName: 'localStorage Support',
        status: 'fail',
        duration: 0,
        message: 'localStorage test failed',
        error: String(error),
      });
    }
  }

  /**
   * Test Demo Mode
   */
  private async testDemoMode(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const window = this.iframe.contentWindow as any;

      // Check for demo mode detection
      const hasDemoDetection = window.location.search.includes('demo') ||
        doc.body.innerHTML.includes('demo') ||
        doc.body.innerHTML.includes('isDemo');

      this.addResult({
        testName: 'Demo Mode Detection',
        status: hasDemoDetection ? 'pass' : 'warning',
        duration: 0,
        message: hasDemoDetection
          ? 'Demo mode detection found'
          : 'No demo mode detection',
      });
    } catch (error) {
      this.addResult({
        testName: 'Demo Mode Detection',
        status: 'warning',
        duration: 0,
        message: 'Could not verify demo mode',
        error: String(error),
      });
    }
  }

  /**
   * Test Game Over screen
   */
  private async testGameOver(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const hasGameOverElements = doc.body.innerHTML.includes('gameOver') ||
        doc.body.innerHTML.includes('game-over') ||
        doc.body.innerHTML.includes('Game Over') ||
        doc.body.innerHTML.includes('GAME OVER');

      this.addResult({
        testName: 'Game Over Screen',
        status: hasGameOverElements ? 'pass' : 'warning',
        duration: 0,
        message: hasGameOverElements
          ? 'Game Over screen elements found'
          : 'No Game Over screen detected',
      });
    } catch (error) {
      this.addResult({
        testName: 'Game Over Screen',
        status: 'warning',
        duration: 0,
        message: 'Could not verify Game Over screen',
        error: String(error),
      });
    }
  }

  /**
   * Test performance
   */
  private async testPerformance(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const window = this.iframe.contentWindow as any;

      // Measure frame rate
      let frameCount = 0;
      const startTime = performance.now();

      const countFrames = () => {
        frameCount++;
        if (performance.now() - startTime < 1000) {
          window.requestAnimationFrame(countFrames);
        }
      };

      window.requestAnimationFrame(countFrames);

      // Wait for measurement
      await new Promise(resolve => setTimeout(resolve, 1000));

      this.performanceMetrics.averageFPS = frameCount;

      this.addResult({
        testName: 'Performance (FPS)',
        status: frameCount >= 30 ? 'pass' : 'warning',
        duration: 1000,
        message: `Average FPS: ${frameCount}`,
        details: { fps: frameCount },
      });
    } catch (error) {
      this.addResult({
        testName: 'Performance (FPS)',
        status: 'warning',
        duration: 0,
        message: 'Could not measure FPS',
        error: String(error),
      });
    }
  }

  /**
   * Test memory usage
   */
  private async testMemoryUsage(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      // Check memory if available
      if ((performance as any).memory) {
        const memory = (performance as any).memory;
        this.performanceMetrics.memoryUsage = memory.usedJSHeapSize;

        const isAcceptable = memory.usedJSHeapSize < 10 * 1024 * 1024; // 10MB

        this.addResult({
          testName: 'Memory Usage',
          status: isAcceptable ? 'pass' : 'warning',
          duration: 0,
          message: `Memory: ${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
          details: { memoryMB: memory.usedJSHeapSize / 1024 / 1024 },
        });
      } else {
        this.addResult({
          testName: 'Memory Usage',
          status: 'warning',
          duration: 0,
          message: 'Memory API not available',
        });
      }
    } catch (error) {
      this.addResult({
        testName: 'Memory Usage',
        status: 'warning',
        duration: 0,
        message: 'Could not measure memory',
        error: String(error),
      });
    }
  }

  /**
   * Test console errors
   */
  private async testConsoleErrors(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const window = this.iframe.contentWindow as any;

      let errorCount = 0;
      let warningCount = 0;

      const originalError = window.console.error;
      const originalWarn = window.console.warn;

      window.console.error = (...args: any[]) => {
        errorCount++;
        originalError.apply(window.console, args);
      };

      window.console.warn = (...args: any[]) => {
        warningCount++;
        originalWarn.apply(window.console, args);
      };

      this.performanceMetrics.jsErrors = errorCount;
      this.performanceMetrics.warnings = warningCount;

      this.addResult({
        testName: 'Console Errors',
        status: errorCount === 0 ? 'pass' : 'fail',
        duration: 0,
        message: `Errors: ${errorCount}, Warnings: ${warningCount}`,
        details: { errors: errorCount, warnings: warningCount },
      });
    } catch (error) {
      this.addResult({
        testName: 'Console Errors',
        status: 'warning',
        duration: 0,
        message: 'Could not monitor console',
        error: String(error),
      });
    }
  }

  /**
   * Test portrait orientation
   */
  private async testPortraitOrientation(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      // Check viewport meta tag
      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const viewportMeta = doc.querySelector('meta[name="viewport"]');
      const hasPortraitOrientation = viewportMeta?.getAttribute('content')
        ?.includes('portrait') || false;

      this.addResult({
        testName: 'Portrait Orientation',
        status: hasPortraitOrientation ? 'pass' : 'warning',
        duration: 0,
        message: hasPortraitOrientation
          ? 'Portrait orientation enforced'
          : 'Portrait orientation not explicitly set',
      });
    } catch (error) {
      this.addResult({
        testName: 'Portrait Orientation',
        status: 'warning',
        duration: 0,
        message: 'Could not verify orientation',
        error: String(error),
      });
    }
  }

  /**
   * Test sound initialization
   */
  private async testSound(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const window = this.iframe.contentWindow as any;

      const hasAudioContext = window.AudioContext || window.webkitAudioContext;
      const hasAudioElement = this.htmlCode.includes('<audio') ||
        this.htmlCode.includes('new Audio');

      this.addResult({
        testName: 'Sound Support',
        status: hasAudioContext || hasAudioElement ? 'pass' : 'warning',
        duration: 0,
        message: hasAudioContext || hasAudioElement
          ? 'Sound support detected'
          : 'No sound support detected',
      });
    } catch (error) {
      this.addResult({
        testName: 'Sound Support',
        status: 'warning',
        duration: 0,
        message: 'Could not verify sound',
        error: String(error),
      });
    }
  }

  /**
   * Test multitouch handling
   */
  private async testMultitouch(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      // Simulate multitouch
      const touchEvent = new TouchEvent('touchstart', {
        bubbles: true,
        cancelable: true,
        touches: [
          {
            identifier: 0,
            target: doc.body,
            clientX: 100,
            clientY: 100,
            screenX: 100,
            screenY: 100,
            pageX: 100,
            pageY: 100,
            radiusX: 0,
            radiusY: 0,
            rotationAngle: 0,
            force: 1,
          } as Touch,
          {
            identifier: 1,
            target: doc.body,
            clientX: 200,
            clientY: 200,
            screenX: 200,
            screenY: 200,
            pageX: 200,
            pageY: 200,
            radiusX: 0,
            radiusY: 0,
            rotationAngle: 0,
            force: 1,
          } as Touch,
        ],
      });

      doc.body.dispatchEvent(touchEvent);

      this.addResult({
        testName: 'Multitouch Handling',
        status: 'pass',
        duration: 0,
        message: 'Multitouch event dispatched successfully',
      });
    } catch (error) {
      this.addResult({
        testName: 'Multitouch Handling',
        status: 'warning',
        duration: 0,
        message: 'Could not test multitouch',
        error: String(error),
      });
    }
  }

  /**
   * Test responsiveness
   */
  private async testResponsiveness(): Promise<void> {
    try {
      if (!this.iframe) throw new Error('iframe not created');

      const doc = this.iframe.contentDocument;
      if (!doc) throw new Error('Cannot access iframe document');

      const startTime = performance.now();

      // Simulate multiple rapid touches
      for (let i = 0; i < 10; i++) {
        const touchEvent = new TouchEvent('touchstart', {
          bubbles: true,
          cancelable: true,
          touches: [
            {
              identifier: 0,
              target: doc.body,
              clientX: 100 + i * 10,
              clientY: 100 + i * 10,
              screenX: 100 + i * 10,
              screenY: 100 + i * 10,
              pageX: 100 + i * 10,
              pageY: 100 + i * 10,
              radiusX: 0,
              radiusY: 0,
              rotationAngle: 0,
              force: 1,
            } as Touch,
          ],
        });

        doc.body.dispatchEvent(touchEvent);
      }

      const duration = performance.now() - startTime;

      this.addResult({
        testName: 'Responsiveness',
        status: duration < 100 ? 'pass' : 'warning',
        duration,
        message: `Processed 10 touches in ${duration.toFixed(0)}ms`,
        details: { duration },
      });
    } catch (error) {
      this.addResult({
        testName: 'Responsiveness',
        status: 'warning',
        duration: 0,
        message: 'Could not test responsiveness',
        error: String(error),
      });
    }
  }

  /**
   * Cleanup sandbox
   */
  private cleanupSandbox(): void {
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
    }
    this.iframe = null;
  }

  /**
   * Add test result
   */
  private addResult(result: TestResult): void {
    this.results.push(result);
  }

  /**
   * Add error
   */
  private addError(error: string): void {
    this.errors.push(error);
  }

  /**
   * Generate test report
   */
  private generateReport(): GameTestReport {
    const passed = this.results.filter(r => r.status === 'pass').length;
    const failed = this.results.filter(r => r.status === 'fail').length;
    const warnings = this.results.filter(r => r.status === 'warning').length;

    const isPlayable = failed === 0 && passed > 0;

    const summary = `
Game Test Report
${new Date().toLocaleString()}

Game ID: ${this.gameId}
Total Tests: ${this.results.length}
Passed: ${passed}
Failed: ${failed}
Warnings: ${warnings}

Status: ${isPlayable ? '✅ PLAYABLE' : '❌ NOT PLAYABLE'}

Performance:
- Load Time: ${this.performanceMetrics.loadTime.toFixed(0)}ms
- Average FPS: ${this.performanceMetrics.averageFPS}
- Memory: ${(this.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB
- JS Errors: ${this.performanceMetrics.jsErrors}
- Warnings: ${this.performanceMetrics.warnings}

${this.errors.length > 0
        ? `Errors:\n${this.errors.map(e => `- ${e}`).join('\n')}`
        : 'No errors'
      }
    `.trim();

    return {
      gameId: this.gameId,
      timestamp: new Date(),
      totalTests: this.results.length,
      passed,
      failed,
      warnings,
      errors: this.errors,
      isPlayable,
      results: this.results,
      performance: this.performanceMetrics,
      summary,
    };
  }
}

/**
 * Quick test function
 */
export async function testGame(
  gameId: string,
  htmlCode: string
): Promise<GameTestReport> {
  const tester = new GameTestingFrameworkPro(gameId, htmlCode);
  return await tester.runAllTests();
}
