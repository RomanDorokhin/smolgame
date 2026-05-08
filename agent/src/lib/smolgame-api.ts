/**
 * SmolGame API Client
 * Integrated with smolgame.dorokhin731.workers.dev backend
 */

const API_BASE = 'https://smolgame.dorokhin731.workers.dev';
const INIT_DATA_SS_KEY = 'smolgame:tgInitData:v1';
const WEB_ID_LS_KEY = 'smolgame:webId:v1';
const PENDING_GAME_LS_KEY = 'smolgame:pendingGame:v1';

export interface SmolGameUser {
  id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  photo_url?: string;
  isGithubConnected?: boolean;
  githubUsername?: string;
}

export class SmolGameAPI {
  /**
   * Extract initData from URL or sessionStorage
   */
  static getInitData(): string {
    // 0. Try official Telegram WebApp API
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData) {
        console.log("Found initData in window.Telegram.WebApp");
        return tg.initData;
      }
    } catch (e) {}

    // 1. Try URL fragment (hash) - common in Telegram
    const hash = window.location.hash || '';
    if (hash.includes('tgWebAppData=')) {
      console.log("Found initData in URL Hash");
      const match = hash.match(/tgWebAppData=([^&]+)/);
      if (match) {
        const data = decodeURIComponent(match[1]);
        this.persistInitData(data);
        return data;
      }
    }

    // 2. Try URL query params
    const search = window.location.search || '';
    if (search.includes('tgWebAppData=')) {
      console.log("Found initData in URL Search");
      const params = new URLSearchParams(search);
      const data = params.get('tgWebAppData');
      if (data) {
        this.persistInitData(data);
        return data;
      }
    }

    // 3. Try sessionStorage (cache)
    try {
      const stored = sessionStorage.getItem(INIT_DATA_SS_KEY);
      if (stored) console.log("Found initData in sessionStorage");
      return stored || '';
    } catch (e) {
      return '';
    }
  }

  static persistInitData(data: string) {
    if (!data || !data.includes('hash=')) return;
    try {
      sessionStorage.setItem(INIT_DATA_SS_KEY, data);
    } catch (e) { /* ignore */ }
  }

  static getWebId(): string {
    // Sync with main site PERSIST_ID_KEY from state.js
    const PERSIST_ID_KEY = 'smolgame:persisted_id:v1';
    let id = localStorage.getItem(PERSIST_ID_KEY);
    
    // Fallback only if absolutely empty
    if (!id) {
      id = localStorage.getItem(WEB_ID_LS_KEY);
    }
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(PERSIST_ID_KEY, id);
    }
    return id;
  }

  /**
   * Generic fetch with Telegram authentication
   */
  static async apiFetch(path: string, options: RequestInit = {}) {
    const initData = this.getInitData();
    const webId = this.getWebId();
    
    // Add web_id for identification
    const separator = path.includes('?') ? '&' : '?';
    const finalPath = `${path}${separator}web_id=${webId}`;

    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
      'x-web-id': webId,
    };

    if (initData) {
      headers['x-telegram-init-data'] = initData;
    }

    let body = options.body;
    if (body && !(body instanceof FormData) && typeof body !== 'string') {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(body);
    } else if (body && typeof body === 'string') {
      headers['Content-Type'] = 'application/json';
    }

    const maxRetries = 3;
    let lastErr: any = null;

    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(`${API_BASE}${finalPath}`, {
          ...options,
          headers,
          body
        });

        const contentType = response.headers.get('content-type');
        let data;
        if (contentType && contentType.includes('application/json')) {
          try {
            data = await response.json();
          } catch (e) {
            data = await response.text();
          }
        } else {
          data = await response.text();
        }

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Сессия Telegram устарела. Пожалуйста, полностью перезапусти приложение SmolGame.');
          }
          if (response.status >= 500 && i < maxRetries - 1) {
            console.warn(`[API] Server error ${response.status}, retrying ${i+1}/${maxRetries}...`);
            await new Promise(r => setTimeout(r, 1000 * (i + 1)));
            continue;
          }
          const errorMsg = (typeof data === 'object' ? data?.error : data) || response.statusText || 'Unknown error';
          throw new Error(`${errorMsg} (Status: ${response.status})`);
        }

        return data;
      } catch (err: any) {
        lastErr = err;
        if (err.message?.includes('fetch') && i < maxRetries - 1) {
          console.warn(`[API] Network error, retrying ${i+1}/${maxRetries}...`);
          await new Promise(r => setTimeout(r, 1000 * (i + 1)));
          continue;
        }
        throw err;
      }
    }
    throw lastErr;
  }

  /**
   * Get current user profile and GitHub status
   */
  static async getMe(): Promise<SmolGameUser> {
    return this.apiFetch('/api/me');
  }

  /**
   * Start GitHub OAuth flow
   */
  static async githubOAuthStart(): Promise<{ url: string }> {
    return this.apiFetch('/api/auth/github/start');
  }

  /**
   * Unlink GitHub account
   */
  static async githubUnlink(): Promise<void> {
    return this.apiFetch('/api/auth/github/unlink', { method: 'POST' });
  }

  /**
   * Delegate heavy-duty generation to OpenGame API
   */
  static async generateWithOpenGame(payload: {
    prompt: string;
    apiKey: string;
    model?: string;
    provider?: string;
  }): Promise<{ success: boolean; code: string; gameId: string }> {
    // Note: In production this would be a real URL, for now we use localhost
    const OPENGAME_API = 'http://localhost:3001';
    const response = await fetch(`${OPENGAME_API}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'OpenGame generation failed');
    }

    return response.json();
  }

  /**
   * Publish game to GitHub
   */
  static async publishGame(payload: {
    files: Array<{ path: string; content: string }>;
    gameTitle: string;
    gameDescription?: string;
  }) {
    // The backend EXPECTS this exact JSON structure (see github-publish.js:42)
    const body = {
      files: payload.files,
      gameTitle: payload.gameTitle,
      gameDescription: payload.gameDescription
    };

    return this.apiFetch('/api/github/publish-game', {
      method: 'POST',
      body: body,
    });
  }

  /**
   * Delete game from database and GitHub
   */
  static async deleteGame(gameId: string) {
    return this.apiFetch(`/api/games/${gameId}`, {
      method: 'DELETE',
      body: { deleteGithubRepo: true }
    });
  }

  /**
   * Poll GitHub Pages URL until it becomes available (up to ~3 min)
   * Resolves with true when page responds OK, false on timeout.
   */
  static async pollPagesReady(
    pagesUrl: string,
    onProgress?: (attempt: number, maxAttempts: number) => void
  ): Promise<boolean> {
    const maxAttempts = 30;   // ~4 minutes max
    const intervalMs = 8000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      onProgress?.(attempt, maxAttempts);
      try {
        // Try a real fetch to see if it's alive. 
        // We use a timestamp to bypass any interim caches.
        const res = await fetch(`${pagesUrl}?t=${Date.now()}`, { 
          method: 'GET',
          // Note: GitHub Pages might block CORS for fetch, 
          // but we can at least detect a difference between "Network Error" and "Ready"
        });
        
        // If we get a 200, we are definitely ready.
        if (res.status === 200) {
          // Extra buffer for CDN propagation
          await new Promise(r => setTimeout(r, 3000));
          return true;
        }
      } catch (err) {
        // Network error usually means it's not even resolving yet
      }
      
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, intervalMs));
      }
    }
    return false;
  }

  /**
   * Save a pending (pre-auth) game to localStorage so it survives redirect
   */
  static savePendingGame(data: { htmlCode: string; title: string }) {
    try {
      localStorage.setItem(PENDING_GAME_LS_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch { /* ignore quota errors */ }
  }

  /**
   * Load and clear the pending game (returns null if none / expired after 10 min)
   */
  static popPendingGame(): { htmlCode: string; title: string } | null {
    try {
      const raw = localStorage.getItem(PENDING_GAME_LS_KEY);
      if (!raw) return null;
      localStorage.removeItem(PENDING_GAME_LS_KEY);
      const data = JSON.parse(raw);
      // Expire after 10 minutes
      if (Date.now() - (data.savedAt ?? 0) > 10 * 60 * 1000) return null;
      return { htmlCode: data.htmlCode, title: data.title };
    } catch {
      return null;
    }
  }

  /**
   * Fetch game file content from GitHub
   */
  static async getGameFile(repo: string, path: string = 'index.html'): Promise<{ path: string, sha: string, content: string }> {
    return this.apiFetch(`/api/github/get-file?repo=${encodeURIComponent(repo)}&path=${encodeURIComponent(path)}`);
  }

  /**
   * Update game file on GitHub
   */
  static async updateGameFile(payload: {
    repo: string;
    path: string;
    content: string;
    sha: string;
    message?: string;
  }): Promise<{ ok: boolean, sha: string }> {
    return this.apiFetch('/api/github/update-file', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /**
   * Get current user's games
   */
  static async getMyGames(): Promise<{ games: any[] }> {
    return this.apiFetch('/api/me/games');
  }

  /**
   * Secure AI Chat via Backend Proxy
   */
  static async* chatStream(payload: {
    messages: any[];
    provider: string;
    model?: string;
  }, signal?: AbortSignal): AsyncGenerator<string> {
    const initData = this.getInitData();
    const webId = this.getWebId();
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-web-id': webId,
    };
    if (initData) headers['x-telegram-init-data'] = initData;

    const response = await fetch(`${API_BASE}/api/ai/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ ...payload, stream: true }),
      signal
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(err.error || `API Error ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("API returned an empty body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      yield chunk;
    }
  }
}
