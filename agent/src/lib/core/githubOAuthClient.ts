/**
 * GitHub OAuth Client
 * Seamless GitHub login without manual token entry
 */

export interface GitHubUser {
  id: number;
  login: string;
  name: string;
  avatar_url: string;
  bio?: string;
  public_repos: number;
}

export interface GitHubOAuthConfig {
  clientId: string;
  clientSecret?: string; // Only needed for server-side
  redirectUri: string;
  scope?: string[];
}

export interface GitHubAuthToken {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in?: number;
}

export class GitHubOAuthClient {
  private config: GitHubOAuthConfig;
  private authorizationUrl = 'https://github.com/login/oauth/authorize';
  private apiBaseUrl = 'https://api.github.com';

  constructor(config: GitHubOAuthConfig) {
    this.config = {
      scope: ['repo', 'workflow'],
      ...config,
    };
  }

  /**
   * Get authorization URL for login
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope?.join(' ') || 'repo workflow',
      state: state || this.generateState(),
    });

    return `${this.authorizationUrl}?${params.toString()}`;
  }

  /**
   * Handle OAuth callback and get token
   */
  async handleCallback(_code: string): Promise<GitHubAuthToken> {
    // This needs to be handled by backend to avoid CORS issues
    // Frontend should pass code to backend which exchanges it for token
    throw new Error(
      'OAuth token exchange must be handled by backend. Pass code to your server.'
    );
  }

  /**
   * Get current user info
   */
  async getCurrentUser(accessToken: string): Promise<GitHubUser> {
    const response = await fetch(`${this.apiBaseUrl}/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch user info');
    }

    return response.json();
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    return Math.random().toString(36).substring(7);
  }

  /**
   * Save token to localStorage
   */
  static saveToken(token: string): void {
    localStorage.setItem('github_access_token', token);
  }

  /**
   * Get token from localStorage
   */
  static getToken(): string | null {
    return localStorage.getItem('github_access_token');
  }

  /**
   * Clear token from localStorage
   */
  static clearToken(): void {
    localStorage.removeItem('github_access_token');
  }

  /**
   * Check if user is authenticated
   */
  static isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * Save user info to localStorage
   */
  static saveUser(user: GitHubUser): void {
    localStorage.setItem('github_user', JSON.stringify(user));
  }

  /**
   * Get user info from localStorage
   */
  static getUser(): GitHubUser | null {
    const stored = localStorage.getItem('github_user');
    return stored ? JSON.parse(stored) : null;
  }

  /**
   * Clear user info from localStorage
   */
  static clearUser(): void {
    localStorage.removeItem('github_user');
  }

  /**
   * Logout
   */
  static logout(): void {
    this.clearToken();
    this.clearUser();
  }
}

/**
 * Get OAuth client instance
 */
export function getGitHubOAuthClient(clientId: string): GitHubOAuthClient {
  const redirectUri = `${window.location.origin}/auth/github/callback`;

  return new GitHubOAuthClient({
    clientId,
    redirectUri,
  });
}

/**
 * Check if we're in OAuth callback
 */
export function isOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search);
  return !!params.get('code');
}

/**
 * Get OAuth code from URL
 */
export function getOAuthCode(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('code');
}

/**
 * Get OAuth error from URL
 */
export function getOAuthError(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('error');
}
