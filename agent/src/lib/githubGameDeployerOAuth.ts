/**
 * GitHub Game Deployer (OAuth Version)
 * Uses OAuth token from GitHubOAuthClient
 */

import { GitHubOAuthClient } from './githubOAuthClient';

const SMOLGAME_API_URL = '';

export interface DeploymentConfig {
  token: string; // OAuth access token
  owner: string; // GitHub username
  repo: string; // Repository name
  branch: string; // Branch for Pages (default: gh-pages)
}

export interface DeploymentResult {
  success: boolean;
  gameUrl: string;
  repositoryUrl: string;
  message: string;
  deploymentTime: number;
}

export interface GameMetadata {
  title: string;
  genre: string;
  description: string;
  author: string;
  createdAt: Date;
  version: string;
}

export class GitHubGameDeployerOAuth {
  private config: DeploymentConfig;
  private apiBaseUrl = 'https://api.github.com';

  constructor(config: DeploymentConfig) {
    this.config = config;
  }

  /**
   * Deploy game to GitHub Pages
   */
  async deployGame(
    htmlCode: string,
    gameMetadata: GameMetadata,
    onProgress?: (message: string, progress: number) => void
  ): Promise<DeploymentResult> {
    const startTime = Date.now();

    try {
      this.progress('Creating repository...', 20, onProgress);
      await this.ensureRepository();

      this.progress('Preparing game files...', 40, onProgress);
      const files = this.prepareGameFiles(htmlCode, gameMetadata);

      this.progress('Uploading to GitHub...', 60, onProgress);
      await this.uploadFiles(files);

      this.progress('Enabling GitHub Pages...', 80, onProgress);
      await this.enableGitHubPages();

      const gameUrl = this.generateGameUrl();
      const repositoryUrl = this.generateRepositoryUrl();

      this.progress('Deployment complete!', 100, onProgress);

      const deploymentTime = Math.round((Date.now() - startTime) / 1000);

      return {
        success: true,
        gameUrl,
        repositoryUrl,
        message: `Game deployed successfully!`,
        deploymentTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        gameUrl: '',
        repositoryUrl: '',
        message: `Deployment failed: ${errorMessage}`,
        deploymentTime: Math.round((Date.now() - startTime) / 1000),
      };
    }
  }

  /**
   * Ensure repository exists
   */
  private async ensureRepository(): Promise<void> {
    // Check if repo exists
    const checkResponse = await fetch(
      `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}`,
      {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      }
    );

    if (checkResponse.ok) {
      return; // Repo exists
    }

    if (checkResponse.status === 404) {
      // Create repo
      const createResponse = await fetch(`${this.apiBaseUrl}/user/repos`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: this.config.repo,
          description: 'Games created with OpenSmolGame',
          private: false,
          auto_init: true,
        }),
      });

      if (!createResponse.ok) {
        throw new Error('Failed to create repository');
      }

      return;
    }

    throw new Error('Failed to check repository status');
  }

  /**
   * Prepare game files for upload
   */
  private prepareGameFiles(
    htmlCode: string,
    metadata: GameMetadata
  ): Map<string, string> {
    const files = new Map<string, string>();

    // Main game file
    const gameFilename = `${metadata.title.toLowerCase().replace(/\s+/g, '-')}.html`;
    files.set(gameFilename, htmlCode);

    // README.md
    const readme = `# ${metadata.title}

**Genre:** ${metadata.genre}

${metadata.description}

## Play

[Play Game](${gameFilename})

---

Created with [OpenSmolGame](https://github.com/RomanDorokhin/OpenSmolGame)

Generated: ${metadata.createdAt.toISOString()}
Version: ${metadata.version}
Author: ${metadata.author}
`;
    files.set('README.md', readme);

    // index.html (redirect to game)
    const index = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metadata.title}</title>
  <script>
    window.location.href = '${gameFilename}';
  </script>
</head>
<body>
  <p>Redirecting to game...</p>
</body>
</html>`;
    files.set('index.html', index);

    return files;
  }

  /**
   * Upload files to GitHub
   */
  private async uploadFiles(files: Map<string, string>): Promise<void> {
    for (const [filename, content] of files) {
      await this.uploadFile(filename, content);
    }
  }

  /**
   * Upload single file to GitHub
   */
  private async uploadFile(filename: string, content: string): Promise<void> {
    const url = `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}/contents/${filename}`;

    // Get current file to get SHA (needed for update)
    let sha: string | undefined;
    try {
      const getResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (getResponse.ok) {
        const data = await getResponse.json();
        sha = data.sha;
      }
    } catch (error) {
      // File doesn't exist yet, that's OK
    }

    // Upload/update file
    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `Deploy game: ${filename}`,
        content: btoa(content), // Base64 encode
        sha, // Include SHA if updating
      }),
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload ${filename}`);
    }
  }

  /**
   * Enable GitHub Pages
   */
  private async enableGitHubPages(): Promise<void> {
    const url = `${this.apiBaseUrl}/repos/${this.config.owner}/${this.config.repo}/pages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: {
          branch: this.config.branch,
          path: '/',
        },
      }),
    });

    // 201 = created, 204 = already exists, both are OK
    if (response.status !== 201 && response.status !== 204) {
      console.warn('Could not enable GitHub Pages:', response.status);
    }
  }

  /**
   * Generate game URL
   */
  private generateGameUrl(): string {
    return `https://${this.config.owner}.github.io/${this.config.repo}/`;
  }

  /**
   * Generate repository URL
   */
  private generateRepositoryUrl(): string {
    return `https://github.com/${this.config.owner}/${this.config.repo}`;
  }

  /**
   * Progress callback
   */
  private progress(
    message: string,
    progress: number,
    onProgress?: (message: string, progress: number) => void
  ): void {
    if (onProgress) {
      onProgress(message, progress);
    }
  }

  /**
   * Deploy via SmolGame backend (Official Integration)
   */
  async deployViaSmolGameBackend(
    htmlCode: string,
    metadata: GameMetadata,
    onProgress?: (message: string, progress: number) => void
  ): Promise<DeploymentResult> {
    const startTime = Date.now();
    this.progress('Connecting to SmolGame Backend...', 20, onProgress);

    try {
      // Get Telegram initData
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData || "";

      if (!initData) {
        throw new Error('Telegram WebApp context not found. Use GitHub PAT instead.');
      }

      this.progress('Preparing game for publication...', 50, onProgress);

      const response = await fetch(`${SMOLGAME_API_URL}/api/github/publish-game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-telegram-init-data': initData,
        },
        body: JSON.stringify({
          gameTitle: metadata.title,
          gameDescription: metadata.description,
          files: [
            { path: 'index.html', content: htmlCode }
          ]
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.message || 'Backend deployment failed');
      }

      this.progress('Game is live!', 100, onProgress);

      return {
        success: true,
        gameUrl: result.pagesUrl,
        repositoryUrl: `https://github.com/${result.repo}`,
        message: 'Published successfully via SmolGame!',
        deploymentTime: Math.round((Date.now() - startTime) / 1000),
      };
    } catch (error) {
      console.error('Backend deploy error:', error);
      return {
        success: false,
        gameUrl: '',
        repositoryUrl: '',
        message: error instanceof Error ? error.message : 'Backend deploy failed',
        deploymentTime: Math.round((Date.now() - startTime) / 1000),
      };
    }
  }
}

/**
 * Quick deploy using OAuth token
 */
export async function quickDeployGameOAuth(
  htmlCode: string,
  gameMetadata: GameMetadata,
  onProgress?: (message: string, progress: number) => void
): Promise<DeploymentResult> {
  const token = GitHubOAuthClient.getToken();
  const user = GitHubOAuthClient.getUser();

  if (!token || !user) {
    throw new Error('Not authenticated with GitHub');
  }

  const deployer = new GitHubGameDeployerOAuth({
    token,
    owner: user.login,
    repo: `smol-game-${Date.now()}`,
    branch: 'gh-pages',
  });

  return deployer.deployGame(htmlCode, gameMetadata, onProgress);
}
