import { useState, useEffect } from 'react';
import { SmolGameAPI, type SmolGameUser } from '@/lib/smolgame-api';

export function useAuth() {
  const [user, setUser] = useState<SmolGameUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loginError, setLoginError] = useState<string | null>(null);

  const checkAuth = async () => {
    try {
      const resp = await SmolGameAPI.getMe();
      // Backend returns { user: {...}, stats: {...} } OR a flat SmolGameUser object
      const userData: SmolGameUser = (resp as any).user ?? resp;
      if (userData && userData.id && userData.id !== 'guest') {
        setUser({
          id: userData.id,
          username: (userData as any).siteHandle || (userData as any).username,
          first_name: (userData as any).name || (userData as any).first_name || '',
          photo_url: (userData as any).avatar || (userData as any).photo_url,
          isGithubConnected: Boolean((userData as any).isGithubConnected),
          githubUsername: (userData as any).githubUsername || null,
        });
        setIsAuthenticated(true);
      } else {
        throw new Error("No valid user in response");
      }
    } catch (error) {
      console.warn("[useAuth] Not authenticated via SmolGame Worker — Guest Mode.", error);
      setUser({
        id: 'guest',
        username: 'Guest',
        first_name: 'Guest',
        isGithubConnected: false
      });
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    const handleFocus = () => checkAuth();
    const handleBypass = () => {
      setUser({
        id: 'guest',
        username: 'Guest Tester',
        first_name: 'Guest',
        isGithubConnected: true // Force true for UI bypass
      });
      setIsAuthenticated(true);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('smolgame:auth_bypass', handleBypass);
    
    const interval = setInterval(checkAuth, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('smolgame:auth_bypass', handleBypass);
      clearInterval(interval);
    };
  }, []);

  const login = async () => {
    setLoginError(null);
    const webId = SmolGameAPI.getWebId();
    const API_BASE = 'https://smolgame.dorokhin731.workers.dev';
    
    // Direct redirect for browser - skips the fetch 401 issue
    const oauthUrl = `${API_BASE}/api/github/oauth-start?web_id=${webId}&smol_bypass=1`;

    try {
      // Use Telegram WebApp native method if available
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.openLink && tg?.initData) {
        // If in TG, we still try the fetch way first as it's cleaner
        const { url } = await SmolGameAPI.githubOAuthStart();
        if (url) {
          tg.openLink(url);
          return;
        }
      }
      
      // Fallback/Browser: Direct navigation
      window.location.href = oauthUrl;
    } catch (err: any) {
      console.error("[useAuth] Login failed, trying direct redirect", err);
      window.location.href = oauthUrl;
    }
  };

  const clearLoginError = () => setLoginError(null);

  const logout = async () => {
    try {
      await SmolGameAPI.githubUnlink();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("[useAuth] Failed to unlink GitHub", error);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    loginError,
    clearLoginError,
    login,
    logout,
    refresh: checkAuth,
    isGithubConnected: user?.isGithubConnected || false,
    githubUsername: user?.githubUsername || null,
  };
}
