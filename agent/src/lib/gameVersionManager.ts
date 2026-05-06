/**
 * Game Version Manager
 * Handles versioning, history, and rollback
 */

import type { GameSpec, ValidationReport } from './gameRequirementValidatorPro';

export interface GameVersion {
  id: string;
  htmlCode: string;
  gameSpec: GameSpec;
  timestamp: Date;
  validationReport: ValidationReport;
  userFeedback?: string;
  isActive: boolean;
  notes: string;
  parentVersionId?: string; // For tracking iteration chains
}

export interface VersionHistory {
  versions: GameVersion[];
  activeVersionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export class GameVersionManager {
  private versions: Map<string, GameVersion> = new Map();
  private activeVersionId: string | null = null;
  private maxVersions = 20; // Keep last 20 versions

  /**
   * Create a new version
   */
  createVersion(
    htmlCode: string,
    gameSpec: GameSpec,
    validationReport: ValidationReport,
    notes: string = '',
    parentVersionId?: string
  ): GameVersion {
    const versionId = this.generateVersionId();
    const version: GameVersion = {
      id: versionId,
      htmlCode,
      gameSpec,
      timestamp: new Date(),
      validationReport,
      isActive: true,
      notes,
      parentVersionId,
    };

    // Deactivate previous active version
    if (this.activeVersionId) {
      const activeVersion = this.versions.get(this.activeVersionId);
      if (activeVersion) {
        activeVersion.isActive = false;
      }
    }

    this.versions.set(versionId, version);
    this.activeVersionId = versionId;

    // Clean up old versions if we exceed max
    this.pruneOldVersions();

    return version;
  }

  /**
   * Get active version
   */
  getActiveVersion(): GameVersion | null {
    if (!this.activeVersionId) return null;
    return this.versions.get(this.activeVersionId) || null;
  }

  /**
   * Get specific version
   */
  getVersion(versionId: string): GameVersion | null {
    return this.versions.get(versionId) || null;
  }

  /**
   * Get all versions
   */
  getAllVersions(): GameVersion[] {
    return Array.from(this.versions.values()).sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );
  }

  /**
   * Rollback to specific version
   */
  rollbackToVersion(versionId: string): GameVersion | null {
    const version = this.versions.get(versionId);
    if (!version) return null;

    // Deactivate current active version
    if (this.activeVersionId) {
      const activeVersion = this.versions.get(this.activeVersionId);
      if (activeVersion) {
        activeVersion.isActive = false;
      }
    }

    // Create a new version based on the rolled-back version
    const rolledBackVersion = this.createVersion(
      version.htmlCode,
      version.gameSpec,
      version.validationReport,
      `Rolled back from version ${versionId}`,
      versionId
    );

    return rolledBackVersion;
  }

  /**
   * Compare two versions
   */
  compareVersions(
    versionId1: string,
    versionId2: string
  ): { added: string; removed: string; changed: string } {
    const v1 = this.versions.get(versionId1);
    const v2 = this.versions.get(versionId2);

    if (!v1 || !v2) {
      return { added: '', removed: '', changed: '' };
    }

    const code1 = v1.htmlCode;
    const code2 = v2.htmlCode;

    // Simple diff - in production, use a proper diff library
    const lines1 = code1.split('\n');
    const lines2 = code2.split('\n');

    const added = lines2.filter(line => !lines1.includes(line)).join('\n');
    const removed = lines1.filter(line => !lines2.includes(line)).join('\n');
    const changed = `${lines1.length} → ${lines2.length} lines`;

    return { added, removed, changed };
  }

  /**
   * Get version metadata
   */
  getVersionMetadata(versionId: string): {
    isValid: boolean;
    failedRequirements: number;
    warnings: number;
    fileSize: string;
    createdAt: string;
  } | null {
    const version = this.versions.get(versionId);
    if (!version) return null;

    const fileSize = (new Blob([version.htmlCode]).size / 1024).toFixed(1);

    return {
      isValid: version.validationReport.isValid,
      failedRequirements: version.validationReport.failed,
      warnings: version.validationReport.warnings,
      fileSize: `${fileSize}KB`,
      createdAt: version.timestamp.toISOString(),
    };
  }

  /**
   * Export version history to JSON
   */
  exportHistory(): VersionHistory {
    return {
      versions: this.getAllVersions(),
      activeVersionId: this.activeVersionId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Import version history from JSON
   */
  importHistory(history: VersionHistory): void {
    this.versions.clear();
    history.versions.forEach(version => {
      this.versions.set(version.id, version);
    });
    this.activeVersionId = history.activeVersionId;
  }

  /**
   * Save to localStorage
   */
  saveToLocalStorage(key: string = 'gameVersionHistory'): void {
    const history = this.exportHistory();
    try {
      localStorage.setItem(key, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save version history to localStorage:', error);
    }
  }

  /**
   * Load from localStorage
   */
  loadFromLocalStorage(key: string = 'gameVersionHistory'): boolean {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return false;

      const history = JSON.parse(stored) as VersionHistory;
      this.importHistory(history);
      return true;
    } catch (error) {
      console.error('Failed to load version history from localStorage:', error);
      return false;
    }
  }

  /**
   * Clear all versions
   */
  clear(): void {
    this.versions.clear();
    this.activeVersionId = null;
  }

  /**
   * Get version count
   */
  getVersionCount(): number {
    return this.versions.size;
  }

  /**
   * Get version chain (parent → child relationships)
   */
  getVersionChain(versionId: string): GameVersion[] {
    const chain: GameVersion[] = [];
    let current = this.versions.get(versionId);

    while (current) {
      chain.unshift(current);
      if (current.parentVersionId) {
        current = this.versions.get(current.parentVersionId);
      } else {
        break;
      }
    }

    return chain;
  }

  /**
   * Generate unique version ID
   */
  private generateVersionId(): string {
    return `v${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  /**
   * Remove old versions if exceeding max
   */
  private pruneOldVersions(): void {
    if (this.versions.size <= this.maxVersions) return;

    const sortedVersions = this.getAllVersions();
    const toDelete = sortedVersions.slice(this.maxVersions);

    toDelete.forEach(version => {
      this.versions.delete(version.id);
    });
  }
}

/**
 * Global version manager instance
 */
let globalVersionManager: GameVersionManager | null = null;

export function getGlobalVersionManager(): GameVersionManager {
  if (!globalVersionManager) {
    globalVersionManager = new GameVersionManager();
    // Try to restore from localStorage
    globalVersionManager.loadFromLocalStorage();
  }
  return globalVersionManager;
}

export function resetGlobalVersionManager(): void {
  globalVersionManager = null;
}
