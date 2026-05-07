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
    window.addEventListener('focus', handleFocus);
    const interval = setInterval(checkAuth, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const login = async () => {
    setLoginError(null);
    try {
      const { url } = await SmolGameAPI.githubOAuthStart();
      if (url) {
        window.location.href = url;
      } else {
        setLoginError('Сервер не вернул URL для входа. Попробуй ещё раз.');
      }
    } catch (err: any) {
      console.error("[useAuth] Failed to start GitHub OAuth", err);
      // No alert() — surface error via state so UI can render it inline
      setLoginError(
        err?.message?.includes('401') || err?.message?.includes('Telegram')
          ? 'Открой приложение через бота в Telegram — вход доступен только там.'
          : err?.message || 'Не удалось запустить вход через GitHub.'
      );
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
