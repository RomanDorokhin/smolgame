/**
 * Game Flow Orchestrator V2
 * Manages multiple games per user, each with separate repository
 */

import type { GameSpec } from './gameRequirementValidatorPro';
import { GameSessionManagerV2, getUserGames, deleteUserGame } from './gameSessionManagerV2';
import type { GameSessionPhase } from './gameSessionManagerV2';
import { buildGamePrompt, buildGameIterationPrompt } from './interviewFlow';
import { runGamePipeline as generateGameWithPipeline } from './gameGenerationPipelinePro';
import { GitHubOAuthClient } from './githubOAuthClient';

export interface OrchestrationStep {
  phase: GameSessionPhase;
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  message: string;
  progress: number;
  error?: string;
}

export interface OrchestrationCallback {
  onPhaseChange?: (phase: GameSessionPhase) => void;
  onStepUpdate?: (step: OrchestrationStep) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export class GameFlowOrchestratorV2 {
  private sessionManager: GameSessionManagerV2;
  private userId: string;
  private gameId: string;
  private callbacks: OrchestrationCallback;

  constructor(userId: string, gameId?: string, callbacks: OrchestrationCallback = {}) {
    this.userId = userId;
    this.callbacks = callbacks;

    // Create new game or load existing
    if (gameId) {
      try {
        this.sessionManager = GameSessionManagerV2.loadGame(userId, gameId);
        this.gameId = gameId;
      } catch (error) {
        throw new Error(`Failed to load game: ${gameId}`);
      }
    } else {
      this.sessionManager = GameSessionManagerV2.createNewGame(userId);
      this.gameId = this.sessionManager.getGameId();
    }
  }

  /**
   * Get game ID
   */
  getGameId(): string {
    return this.gameId;
  }

  /**
   * Update interview answer
   */
  updateInterviewAnswer(field: keyof GameSpec, value: string): void {
    this.sessionManager.updateAnswer(field, value);
    this.notifySuccess(`${field} updated`);
  }

  /**
   * Check if interview is complete
   */
  isInterviewComplete(): boolean {
    return this.sessionManager.isInterviewComplete();
  }

  /**
   * Get interview progress
   */
  getInterviewProgress(): { filled: number; total: number; percentage: number } {
    const answers = this.sessionManager.getAnswers();
    const requiredFields = [
      'genre',
      'mechanics',
      'visuals',
      'audience',
      'story',
      'progression',
      'special_features',
    ];

    const filled = requiredFields.filter(field => answers[field as keyof GameSpec]?.trim()).length;
    const total = requiredFields.length;
    const percentage = Math.round((filled / total) * 100);

    return { filled, total, percentage };
  }

  /**
   * Start game generation
   */
  async generateGame(): Promise<boolean> {
    try {
      // Check interview is complete
      if (!this.isInterviewComplete()) {
        this.notifyError('Interview not complete');
        return false;
      }

      // Mark interview as complete
      this.sessionManager.completeInterview();
      this.notifyPhaseChange('generating');

      // Build prompt from answers
      const answers = this.sessionManager.getAnswers() as GameSpec;
      const prompt = buildGamePrompt(answers);

      this.sessionManager.startGeneration(prompt);
      this.notifyStepUpdate({
        phase: 'generating',
        status: 'in_progress',
        message: 'Generating game...',
        progress: 25,
      });

      // Generate initial code with LLM
      const initialResult = await this.callLLMForGeneration(prompt);
      if (!initialResult.success || !initialResult.htmlCode) {
        throw new Error(initialResult.error || 'Initial generation failed');
      }

      // Run quality pipeline on generated code
      const result = await generateGameWithPipeline(
        this.gameId,
        initialResult.htmlCode,
        {
          onProgress: (message) => {
            this.notifyStepUpdate({
              phase: 'generating',
              status: 'in_progress',
              message,
              progress: 50, // Simplified progress
            });
          }
        }
      );

      if (!result.isSuccess || !result.generatedCode) {
        throw new Error(result.errors[0] || 'Quality pipeline failed');
      }

      // Save generated game
      this.sessionManager.saveGeneratedGame(result.generatedCode, result.validationReport);
      this.notifyPhaseChange('ready_to_test');
      this.notifySuccess('Game generated successfully!');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Generation failed';
      this.sessionManager.setGenerationError(errorMessage);
      this.notifyError(errorMessage);
      return false;
    }
  }

  /**
   * Deploy game to GitHub (NEW REPO FOR THIS GAME)
   */
  async deployGame(): Promise<boolean> {
    try {
      const htmlCode = this.sessionManager.getCurrentGameHtml();
      if (!htmlCode) {
        this.notifyError('No game to deploy');
        return false;
      }

      // Check authentication
      if (!GitHubOAuthClient.isAuthenticated()) {
        this.notifyError('Not authenticated with GitHub');
        return false;
      }

      const user = GitHubOAuthClient.getUser();
      if (!user) {
        this.notifyError('User info not available');
        return false;
      }

      this.sessionManager.startDeployment();
      this.notifyPhaseChange('deploying');

      // Create unique repo name for this game
      const repoName = `smol-game-${this.gameId}`;

      this.notifyStepUpdate({
        phase: 'deploying',
        status: 'in_progress',
        message: 'Creating new repository...',
        progress: 25,
      });

      // Create new repository for this game
      const repoUrl = await this.createGameRepository(user.login, repoName, htmlCode);

      if (!repoUrl) {
        throw new Error('Failed to create repository');
      }

      this.notifyStepUpdate({
        phase: 'deploying',
        status: 'in_progress',
        message: 'Enabling GitHub Pages...',
        progress: 60,
      });

      // Enable GitHub Pages
      const gameUrl = await this.enableGitHubPages(user.login, repoName);

      if (!gameUrl) {
        throw new Error('Failed to enable GitHub Pages');
      }

      // Save deployment info
      this.sessionManager.saveDeploymentInfo(repoName, repoUrl, gameUrl);
      this.notifyPhaseChange('playing');
      this.notifySuccess(`Game deployed! Play at: ${gameUrl}`);

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deployment failed';
      this.sessionManager.setGenerationError(errorMessage);
      this.notifyError(errorMessage);
      return false;
    }
  }

  /**
   * Start playing
   */
  startPlaying(): void {
    this.sessionManager.startPlaying();
    this.notifyPhaseChange('playing');
  }

  /**
   * Stop playing
   */
  stopPlaying(): void {
    this.sessionManager.stopPlaying();
  }

  /**
   * Submit feedback for game editing
   */
  async submitFeedback(feedback: string): Promise<boolean> {
    try {
      if (!feedback.trim()) {
        this.notifyError('Feedback cannot be empty');
        return false;
      }

      this.sessionManager.addFeedback(feedback);
      this.notifyPhaseChange('editing');

      // Build edit prompt
      const htmlCode = this.sessionManager.getCurrentGameHtml();
      const answers = this.sessionManager.getAnswers() as GameSpec;

      if (!htmlCode) {
        this.notifyError('No game to edit');
        return false;
      }

      const editPrompt = buildGameIterationPrompt(answers, htmlCode, feedback);

      this.notifyStepUpdate({
        phase: 'editing',
        status: 'in_progress',
        message: 'Editing game based on feedback...',
        progress: 25,
      });

      // Call LLM to edit game
      const editResult = await this.callLLMForEdit(editPrompt);

      if (!editResult.success || !editResult.htmlCode) {
        throw new Error(editResult.error || 'Edit failed');
      }

      // Validate edited game
      this.notifyStepUpdate({
        phase: 'editing',
        status: 'in_progress',
        message: 'Validating changes...',
        progress: 60,
      });

      // Save edited game
      this.sessionManager.saveEditedGame(editResult.htmlCode, feedback, editResult.changes || '');

      // Update GitHub (same repo, just update index.html)
      this.notifyStepUpdate({
        phase: 'updating',
        status: 'in_progress',
        message: 'Updating game on GitHub...',
        progress: 80,
      });

      const deployed = await this.updateGameOnGitHub(editResult.htmlCode);

      if (!deployed) {
        throw new Error('Failed to update game on GitHub');
      }

      this.sessionManager.completeUpdate();
      this.notifyPhaseChange('playing');
      this.notifySuccess('Game updated! Ready to test again.');

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Edit failed';
      this.sessionManager.setGenerationError(errorMessage);
      this.notifyError(errorMessage);
      return false;
    }
  }

  /**
   * Rollback to previous version
   */
  rollbackToPreviousVersion(): boolean {
    const success = this.sessionManager.rollbackToPreviousVersion();
    if (success) {
      this.notifySuccess('Rolled back to previous version');
      this.notifyPhaseChange('playing');
    } else {
      this.notifyError('No previous version available');
    }
    return success;
  }

  /**
   * Get current game HTML
   */
  getCurrentGameHtml(): string | null {
    return this.sessionManager.getCurrentGameHtml();
  }

  /**
   * Get game URL
   */
  getGameUrl(): string | null {
    return this.sessionManager.getGameUrl();
  }

  /**
   * Get repo URL
   */
  getRepoUrl(): string | null {
    return this.sessionManager.getRepoUrl();
  }

  /**
   * Get current phase
   */
  getCurrentPhase(): GameSessionPhase {
    return this.sessionManager.getPhase();
  }

  /**
   * Get session data
   */
  getSession() {
    return this.sessionManager.export();
  }

  /**
   * Delete this game
   */
  deleteGame(): void {
    this.sessionManager.clear();
    deleteUserGame(this.userId, this.gameId);
    this.notifySuccess('Game deleted');
  }

  /**
   * Create new game repository on GitHub
   */
  private async createGameRepository(owner: string, repoName: string, htmlCode: string): Promise<string | null> {
    try {
      const token = GitHubOAuthClient.getToken();
      if (!token) throw new Error('No GitHub token');

      // Create repository
      const createResponse = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: repoName,
          description: 'Game created with OpenSmolGame',
          private: false,
          auto_init: true,
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.message || 'Failed to create repository');
      }

      const repoData = await createResponse.json();
      const repoUrl = repoData.html_url;

      // Upload game HTML
      const uploadResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/contents/index.html`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: 'Initial game upload',
            content: btoa(htmlCode),
          }),
        }
      );

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload game file');
      }

      return repoUrl;
    } catch (error) {
      console.error('Repository creation error:', error);
      return null;
    }
  }

  /**
   * Enable GitHub Pages for repository
   */
  private async enableGitHubPages(owner: string, repoName: string): Promise<string | null> {
    try {
      const token = GitHubOAuthClient.getToken();
      if (!token) throw new Error('No GitHub token');

      // Enable GitHub Pages
      const pagesResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}/pages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            source: {
              branch: 'main',
              path: '/',
            },
          }),
        }
      );

      if (!pagesResponse.ok) {
        // Pages might already be enabled, try to get status
        const getResponse = await fetch(
          `https://api.github.com/repos/${owner}/${repoName}/pages`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: 'application/vnd.github.v3+json',
            },
          }
        );

        if (getResponse.ok) {
          await getResponse.json();
          return `https://${owner}.github.io/${repoName}/`;
        }

        throw new Error('Failed to enable GitHub Pages');
      }

      const pagesData = await pagesResponse.json();
      return pagesData.html_url || `https://${owner}.github.io/${repoName}/`;
    } catch (error) {
      console.error('GitHub Pages error:', error);
      return null;
    }
  }

  /**
   * Update game on GitHub (same repo)
   */
  private async updateGameOnGitHub(htmlCode: string): Promise<boolean> {
    try {
      const repoUrl = this.sessionManager.getRepoUrl();
      if (!repoUrl) {
        throw new Error('No repository URL');
      }

      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) {
        throw new Error('Invalid repository URL');
      }

      const [, owner, repo] = match;
      const token = GitHubOAuthClient.getToken();

      if (!token) {
        throw new Error('No GitHub token');
      }

      // Get current file SHA
      const url = `https://api.github.com/repos/${owner}/${repo}/contents/index.html`;
      const getResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      let sha: string | undefined;
      if (getResponse.ok) {
        const data = await getResponse.json();
        sha = data.sha;
      }

      // Update file
      const updateResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Update game: ${new Date().toISOString()}`,
          content: btoa(htmlCode),
          sha,
        }),
      });

      return updateResponse.ok;
    } catch (error) {
      console.error('GitHub update error:', error);
      return false;
    }
  }

  /**
   * Call LLM for initial game generation
   */
  private async callLLMForGeneration(_prompt: string): Promise<{ success: boolean; htmlCode?: string; error?: string }> {
    try {
      // In production, this would call your actual LLM service
      return {
        success: true,
        htmlCode: '<html><body><h1>New Game</h1></body></html>',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LLM call failed',
      };
    }
  }

  /**
   * Call LLM for game edit
   */
  private async callLLMForEdit(_prompt: string): Promise<{ success: boolean; htmlCode?: string; changes?: string; error?: string }> {
    try {
      // This would call your LLM service
      return {
        success: true,
        htmlCode: '<html><!-- edited game --></html>',
        changes: 'Applied feedback',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'LLM call failed',
      };
    }
  }

  /**
   * Notify phase change
   */
  private notifyPhaseChange(phase: GameSessionPhase): void {
    if (this.callbacks.onPhaseChange) {
      this.callbacks.onPhaseChange(phase);
    }
  }

  /**
   * Notify step update
   */
  private notifyStepUpdate(step: OrchestrationStep): void {
    if (this.callbacks.onStepUpdate) {
      this.callbacks.onStepUpdate(step);
    }
  }

  /**
   * Notify error
   */
  private notifyError(error: string): void {
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Notify success
   */
  private notifySuccess(message: string): void {
    if (this.callbacks.onSuccess) {
      this.callbacks.onSuccess(message);
    }
  }
}

/**
 * Get orchestrator for new game
 */
export function createNewGameOrchestrator(
  userId: string,
  callbacks?: OrchestrationCallback
): GameFlowOrchestratorV2 {
  return new GameFlowOrchestratorV2(userId, undefined, callbacks);
}

/**
 * Get orchestrator for existing game
 */
export function loadGameOrchestrator(
  userId: string,
  gameId: string,
  callbacks?: OrchestrationCallback
): GameFlowOrchestratorV2 {
  return new GameFlowOrchestratorV2(userId, gameId, callbacks);
}

/**
 * Get all games for user
 */
export function getUserGamesForUI(userId: string) {
  return getUserGames(userId);
}
