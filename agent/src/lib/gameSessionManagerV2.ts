/**
 * Game Session Manager V2
 * Each game gets its own repository
 * Multiple games per user, each with separate session
 */

import type { GameSpec } from './gameRequirementValidatorPro';

export type GameSessionPhase = 
  | 'interview'
  | 'generating'
  | 'validating'
  | 'ready_to_test'
  | 'deploying'
  | 'playing'
  | 'editing'
  | 'updating'
  | 'error';

export interface GameVersion {
  id: string;
  htmlCode: string;
  createdAt: Date;
  editCount: number;
  validationReport?: any;
}

export interface Feedback {
  text: string;
  timestamp: Date;
  version: number;
}

export interface Edit {
  feedback: string;
  changes: string;
  timestamp: Date;
  version: number;
}

export interface GameSession {
  // Session metadata
  id: string;
  userId: string;
  gameId: string; // Unique per game
  createdAt: Date;
  updatedAt: Date;
  phase: GameSessionPhase;

  // Interview phase
  interview: {
    answers: Partial<GameSpec>;
    startedAt: Date;
    completedAt?: Date;
  };

  // Development phase
  development: {
    currentHtml: string | null;
    versions: GameVersion[];
    validationReport: any | null;
    generationPrompt: string | null;
    error: string | null;
  };

  // Deployment phase (NEW REPO FOR EACH GAME)
  deployment: {
    repoName: string | null; // smol-game-{timestamp}
    repoUrl: string | null;
    gameUrl: string | null;
    deployedAt: Date | null;
    lastUpdatedAt: Date | null;
  };

  // Iteration phase
  iteration: {
    feedbackHistory: Feedback[];
    editHistory: Edit[];
    currentVersion: number;
    isPlaying: boolean;
  };
}

export interface GamesList {
  userId: string;
  games: Array<{
    gameId: string;
    title: string;
    genre: string;
    createdAt: Date;
    gameUrl?: string;
    repoUrl?: string;
    phase: GameSessionPhase;
  }>;
}

export class GameSessionManagerV2 {
  private session: GameSession;
  private storageKey: string;
  private gamesListKey: string;

  constructor(userId: string, gameId?: string) {
    this.gamesListKey = `game_list_${userId}`;
    
    if (gameId) {
      // Load existing game session
      this.storageKey = `game_session_${userId}_${gameId}`;
      const stored = localStorage.getItem(this.storageKey);
      
      if (stored) {
        this.session = JSON.parse(stored);
      } else {
        throw new Error(`Game session not found: ${gameId}`);
      }
    } else {
      // Create new game session
      const newGameId = this.generateGameId();
      this.storageKey = `game_session_${userId}_${newGameId}`;
      
      this.session = {
        id: this.generateId(),
        userId,
        gameId: newGameId,
        createdAt: new Date(),
        updatedAt: new Date(),
        phase: 'interview',
        interview: {
          answers: {},
          startedAt: new Date(),
        },
        development: {
          currentHtml: null,
          versions: [],
          validationReport: null,
          generationPrompt: null,
          error: null,
        },
        deployment: {
          repoName: null,
          repoUrl: null,
          gameUrl: null,
          deployedAt: null,
          lastUpdatedAt: null,
        },
        iteration: {
          feedbackHistory: [],
          editHistory: [],
          currentVersion: 0,
          isPlaying: false,
        },
      };
    }
  }

  /**
   * Save session to localStorage
   */
  save(): void {
    this.session.updatedAt = new Date();
    localStorage.setItem(this.storageKey, JSON.stringify(this.session));
    this.updateGamesList();
  }

  /**
   * Get current session
   */
  getSession(): GameSession {
    return this.session;
  }

  /**
   * Get game ID
   */
  getGameId(): string {
    return this.session.gameId;
  }

  /**
   * Update interview answer
   */
  updateAnswer(field: keyof GameSpec, value: string): void {
    this.session.interview.answers[field] = value;
    this.save();
  }

  /**
   * Get all interview answers
   */
  getAnswers(): Partial<GameSpec> {
    return this.session.interview.answers;
  }

  /**
   * Check if interview is complete
   */
  isInterviewComplete(): boolean {
    const answers = this.session.interview.answers;
    const requiredFields: (keyof GameSpec)[] = [
      'genre',
      'mechanics',
      'visuals',
      'audience',
      'story',
      'progression',
      'special_features',
    ];

    return requiredFields.every(field => answers[field]?.trim());
  }

  /**
   * Mark interview as complete
   */
  completeInterview(): void {
    this.session.interview.completedAt = new Date();
    this.session.phase = 'generating';
    this.save();
  }

  /**
   * Start game generation
   */
  startGeneration(prompt: string): void {
    this.session.phase = 'generating';
    this.session.development.generationPrompt = prompt;
    this.session.development.error = null;
    this.save();
  }

  /**
   * Save generated game
   */
  saveGeneratedGame(htmlCode: string, validationReport: any): void {
    const version: GameVersion = {
      id: this.generateId(),
      htmlCode,
      createdAt: new Date(),
      editCount: 0,
      validationReport,
    };

    this.session.development.versions.push(version);
    this.session.development.currentHtml = htmlCode;
    this.session.development.validationReport = validationReport;
    this.session.iteration.currentVersion = this.session.development.versions.length - 1;
    this.session.phase = 'ready_to_test';
    this.session.development.error = null;
    this.save();
  }

  /**
   * Handle generation error
   */
  setGenerationError(error: string): void {
    this.session.development.error = error;
    this.session.phase = 'error';
    this.save();
  }

  /**
   * Start deployment
   */
  startDeployment(): void {
    this.session.phase = 'deploying';
    this.save();
  }

  /**
   * Save deployment info (NEW REPO FOR THIS GAME)
   */
  saveDeploymentInfo(repoName: string, repoUrl: string, gameUrl: string): void {
    this.session.deployment.repoName = repoName;
    this.session.deployment.repoUrl = repoUrl;
    this.session.deployment.gameUrl = gameUrl;
    this.session.deployment.deployedAt = new Date();
    this.session.deployment.lastUpdatedAt = new Date();
    this.session.phase = 'playing';
    this.save();
  }

  /**
   * Start playing
   */
  startPlaying(): void {
    this.session.iteration.isPlaying = true;
    this.session.phase = 'playing';
    this.save();
  }

  /**
   * Stop playing
   */
  stopPlaying(): void {
    this.session.iteration.isPlaying = false;
    this.save();
  }

  /**
   * Add feedback
   */
  addFeedback(text: string): void {
    this.session.iteration.feedbackHistory.push({
      text,
      timestamp: new Date(),
      version: this.session.iteration.currentVersion,
    });
    this.session.phase = 'editing';
    this.save();
  }

  /**
   * Start editing
   */
  startEditing(_feedback: string): void {
    this.session.phase = 'editing';
    this.save();
  }

  /**
   * Save edited game
   */
  saveEditedGame(htmlCode: string, feedback: string, changes: string): void {
    const version: GameVersion = {
      id: this.generateId(),
      htmlCode,
      createdAt: new Date(),
      editCount: (this.session.development.versions[this.session.iteration.currentVersion]?.editCount || 0) + 1,
    };

    this.session.development.versions.push(version);
    this.session.development.currentHtml = htmlCode;
    this.session.iteration.currentVersion = this.session.development.versions.length - 1;
    this.session.iteration.editHistory.push({
      feedback,
      changes,
      timestamp: new Date(),
      version: this.session.iteration.currentVersion,
    });
    this.session.deployment.lastUpdatedAt = new Date();
    this.session.phase = 'updating';
    this.save();
  }

  /**
   * Complete update
   */
  completeUpdate(): void {
    this.session.phase = 'playing';
    this.save();
  }

  /**
   * Rollback to previous version
   */
  rollbackToPreviousVersion(): boolean {
    if (this.session.iteration.currentVersion > 0) {
      this.session.iteration.currentVersion--;
      const version = this.session.development.versions[this.session.iteration.currentVersion];
      if (version) {
        this.session.development.currentHtml = version.htmlCode;
        this.session.phase = 'playing';
        this.save();
        return true;
      }
    }
    return false;
  }

  /**
   * Get current game HTML
   */
  getCurrentGameHtml(): string | null {
    return this.session.development.currentHtml;
  }

  /**
   * Get game URL
   */
  getGameUrl(): string | null {
    return this.session.deployment.gameUrl;
  }

  /**
   * Get repo URL
   */
  getRepoUrl(): string | null {
    return this.session.deployment.repoUrl;
  }

  /**
   * Get repo name
   */
  getRepoName(): string | null {
    return this.session.deployment.repoName;
  }

  /**
   * Get version history
   */
  getVersionHistory(): GameVersion[] {
    return this.session.development.versions;
  }

  /**
   * Get feedback history
   */
  getFeedbackHistory(): Feedback[] {
    return this.session.iteration.feedbackHistory;
  }

  /**
   * Get edit history
   */
  getEditHistory(): Edit[] {
    return this.session.iteration.editHistory;
  }

  /**
   * Get current phase
   */
  getPhase(): GameSessionPhase {
    return this.session.phase;
  }

  /**
   * Get error message
   */
  getError(): string | null {
    return this.session.development.error;
  }

  /**
   * Clear error
   */
  clearError(): void {
    this.session.development.error = null;
    this.save();
  }

  /**
   * Export session data
   */
  export(): GameSession {
    return JSON.parse(JSON.stringify(this.session));
  }

  /**
   * Clear session
   */
  clear(): void {
    localStorage.removeItem(this.storageKey);
    this.removeFromGamesList();
  }

  /**
   * Update games list
   */
  private updateGamesList(): void {
    const gamesList = GameSessionManagerV2.getGamesList(this.session.userId);
    
    const existingIndex = gamesList.games.findIndex(g => g.gameId === this.session.gameId);
    
    if (existingIndex >= 0) {
      // Update existing
      gamesList.games[existingIndex] = {
        gameId: this.session.gameId,
        title: this.session.interview.answers.genre || 'Untitled Game',
        genre: this.session.interview.answers.genre || 'Unknown',
        createdAt: this.session.createdAt,
        gameUrl: this.session.deployment.gameUrl || undefined,
        repoUrl: this.session.deployment.repoUrl || undefined,
        phase: this.session.phase,
      };
    } else {
      // Add new
      gamesList.games.push({
        gameId: this.session.gameId,
        title: this.session.interview.answers.genre || 'Untitled Game',
        genre: this.session.interview.answers.genre || 'Unknown',
        createdAt: this.session.createdAt,
        gameUrl: this.session.deployment.gameUrl || undefined,
        repoUrl: this.session.deployment.repoUrl || undefined,
        phase: this.session.phase,
      });
    }

    localStorage.setItem(this.gamesListKey, JSON.stringify(gamesList));
  }

  /**
   * Remove from games list
   */
  private removeFromGamesList(): void {
    const gamesList = GameSessionManagerV2.getGamesList(this.session.userId);
    gamesList.games = gamesList.games.filter(g => g.gameId !== this.session.gameId);
    localStorage.setItem(this.gamesListKey, JSON.stringify(gamesList));
  }

  /**
   * Generate unique game ID
   */
  private generateGameId(): string {
    return `game_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get games list for user
   */
  static getGamesList(userId: string): GamesList {
    const key = `game_list_${userId}`;
    const stored = localStorage.getItem(key);
    
    if (stored) {
      return JSON.parse(stored);
    }

    return {
      userId,
      games: [],
    };
  }

  /**
   * Create new game session
   */
  static createNewGame(userId: string): GameSessionManagerV2 {
    return new GameSessionManagerV2(userId);
  }

  /**
   * Load existing game session
   */
  static loadGame(userId: string, gameId: string): GameSessionManagerV2 {
    return new GameSessionManagerV2(userId, gameId);
  }

  /**
   * Get all games for user
   */
  static getAllGames(userId: string): GamesList {
    return GameSessionManagerV2.getGamesList(userId);
  }

  /**
   * Delete game session
   */
  static deleteGame(userId: string, gameId: string): void {
    const storageKey = `game_session_${userId}_${gameId}`;
    localStorage.removeItem(storageKey);

    const gamesList = GameSessionManagerV2.getGamesList(userId);
    gamesList.games = gamesList.games.filter(g => g.gameId !== gameId);
    localStorage.setItem(`game_list_${userId}`, JSON.stringify(gamesList));
  }
}

/**
 * Get or create session manager for game
 */
export function getGameSessionManager(userId: string, gameId?: string): GameSessionManagerV2 {
  if (gameId) {
    return GameSessionManagerV2.loadGame(userId, gameId);
  } else {
    return GameSessionManagerV2.createNewGame(userId);
  }
}

/**
 * Get all games for user
 */
export function getUserGames(userId: string): GamesList {
  return GameSessionManagerV2.getAllGames(userId);
}

/**
 * Delete game
 */
export function deleteUserGame(userId: string, gameId: string): void {
  GameSessionManagerV2.deleteGame(userId, gameId);
}
