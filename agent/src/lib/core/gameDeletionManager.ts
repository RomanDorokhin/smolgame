/**
 * Game Deletion Manager
 * Handles complete game deletion including GitHub repository cleanup
 */

import { GameSessionManagerV2, deleteUserGame } from './gameSessionManagerV2';
import { GitHubOAuthClient } from './githubOAuthClient';

export interface DeletionStep {
  step: 'preparing' | 'deleting_repo' | 'clearing_local' | 'complete';
  status: 'pending' | 'in_progress' | 'complete' | 'error';
  message: string;
  progress: number;
  error?: string;
}

export interface DeletionCallback {
  onStepUpdate?: (step: DeletionStep) => void;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export class GameDeletionManager {
  private userId: string;
  private gameId: string;
  private callbacks: DeletionCallback;

  constructor(userId: string, gameId: string, callbacks: DeletionCallback = {}) {
    this.userId = userId;
    this.gameId = gameId;
    this.callbacks = callbacks;
  }

  /**
   * Delete game completely (including GitHub repo)
   */
  async deleteGameCompletely(): Promise<boolean> {
    try {
      // Load game session to get repo info
      let sessionManager: GameSessionManagerV2;
      try {
        sessionManager = GameSessionManagerV2.loadGame(this.userId, this.gameId);
      } catch (error) {
        throw new Error('Game not found');
      }

      const repoName = sessionManager.getRepoName();
      const repoUrl = sessionManager.getRepoUrl();

      // Step 1: Preparing
      this.notifyStepUpdate({
        step: 'preparing',
        status: 'in_progress',
        message: 'Preparing to delete game...',
        progress: 25,
      });

      // Step 2: Delete GitHub repository (if it exists)
      if (repoName && repoUrl) {
        this.notifyStepUpdate({
          step: 'deleting_repo',
          status: 'in_progress',
          message: `Deleting GitHub repository: ${repoName}...`,
          progress: 50,
        });

        const repoDeleted = await this.deleteGitHubRepository(repoName);

        if (!repoDeleted) {
          throw new Error('Failed to delete GitHub repository');
        }

        this.notifyStepUpdate({
          step: 'deleting_repo',
          status: 'complete',
          message: `Repository deleted: ${repoName}`,
          progress: 75,
        });
      }

      // Step 3: Clear local storage
      this.notifyStepUpdate({
        step: 'clearing_local',
        status: 'in_progress',
        message: 'Clearing local data...',
        progress: 85,
      });

      deleteUserGame(this.userId, this.gameId);

      this.notifyStepUpdate({
        step: 'clearing_local',
        status: 'complete',
        message: 'Local data cleared',
        progress: 95,
      });

      // Step 4: Complete
      this.notifyStepUpdate({
        step: 'complete',
        status: 'complete',
        message: 'Game deleted successfully',
        progress: 100,
      });

      this.notifySuccess('Game deleted successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Deletion failed';
      this.notifyError(errorMessage);
      return false;
    }
  }

  /**
   * Delete GitHub repository
   */
  private async deleteGitHubRepository(repoName: string): Promise<boolean> {
    try {
      const token = GitHubOAuthClient.getToken();
      if (!token) {
        throw new Error('Not authenticated with GitHub');
      }

      const user = GitHubOAuthClient.getUser();
      if (!user) {
        throw new Error('User info not available');
      }

      const owner = user.login;

      // Delete repository
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repoName}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 204) {
        // 204 No Content = successful deletion
        return true;
      }

      if (response.status === 404) {
        // Repository not found, treat as already deleted
        console.warn('Repository not found on GitHub (already deleted?)');
        return true;
      }

      const error = await response.json();
      throw new Error(error.message || 'Failed to delete repository');
    } catch (error) {
      console.error('GitHub deletion error:', error);
      return false;
    }
  }

  /**
   * Notify step update
   */
  private notifyStepUpdate(step: DeletionStep): void {
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
 * Delete game with confirmation
 */
export async function deleteGameWithConfirmation(
  userId: string,
  gameId: string,
  gameName: string,
  callbacks?: DeletionCallback
): Promise<boolean> {
  // Show confirmation dialog
  const confirmed = confirm(
    `Are you sure you want to delete "${gameName}"?\n\nThis will:\n- Delete the game from your account\n- Delete the GitHub repository\n- Remove all game data\n\nThis action cannot be undone.`
  );

  if (!confirmed) {
    return false;
  }

  // Proceed with deletion
  const manager = new GameDeletionManager(userId, gameId, callbacks);
  return await manager.deleteGameCompletely();
}

/**
 * Batch delete games
 */
export async function batchDeleteGames(
  userId: string,
  gameIds: string[],
  callbacks?: DeletionCallback
): Promise<{ successful: string[]; failed: string[] }> {
  const successful: string[] = [];
  const failed: string[] = [];

  for (const gameId of gameIds) {
    try {
      const manager = new GameDeletionManager(userId, gameId, callbacks);
      const deleted = await manager.deleteGameCompletely();

      if (deleted) {
        successful.push(gameId);
      } else {
        failed.push(gameId);
      }
    } catch (error) {
      failed.push(gameId);
    }
  }

  return { successful, failed };
}

/**
 * Export game before deletion (for backup)
 */
export async function exportGameBeforeDeletion(
  userId: string,
  gameId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const sessionManager = GameSessionManagerV2.loadGame(userId, gameId);
    const session = sessionManager.export();

    // Create JSON export
    const exportData = {
      gameId,
      exportedAt: new Date().toISOString(),
      session,
    };

    const jsonString = JSON.stringify(exportData, null, 2);

    // Create download
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-backup-${gameId}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);

    return { success: true, data: jsonString };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Export failed';
    return { success: false, error: errorMessage };
  }
}

/**
 * Archive game instead of deleting (keep local, delete repo)
 */
export async function archiveGame(
  userId: string,
  gameId: string,
  callbacks?: DeletionCallback
): Promise<boolean> {
  try {
    const manager = new GameDeletionManager(userId, gameId, callbacks);

    // Load game session
    const sessionManager = GameSessionManagerV2.loadGame(userId, gameId);
    const repoName = sessionManager.getRepoName();

    if (repoName) {
      // Delete GitHub repo only
      const repoDeleted = await manager['deleteGitHubRepository'](repoName);

      if (!repoDeleted) {
        throw new Error('Failed to delete repository');
      }

      // Clear deployment info but keep local data
      const session = sessionManager.export();
      session.deployment.repoName = null;
      session.deployment.repoUrl = null;
      session.deployment.gameUrl = null;

      // Save updated session
      localStorage.setItem(
        `game_session_${userId}_${gameId}`,
        JSON.stringify(session)
      );

      return true;
    }

    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Archive failed';
    if (callbacks?.onError) {
      callbacks.onError(errorMessage);
    }
    return false;
  }
}

/**
 * Get deletion confirmation message
 */
export function getDeletionConfirmationMessage(gameName: string): string {
  return `Are you sure you want to delete "${gameName}"?

This will:
• Delete the game from your account
• Delete the GitHub repository (${gameName})
• Remove all game data
• Cannot be undone

Do you want to proceed?`;
}

/**
 * Get archival confirmation message
 */
export function getArchivalConfirmationMessage(gameName: string): string {
  return `Archive "${gameName}"?

This will:
• Keep the game data locally
• Delete the GitHub repository
• Game will be marked as archived
• Can be re-deployed later

Do you want to proceed?`;
}
