import { useState, useEffect } from 'react';
import { SmolGameAPI, type SmolGameUser } from '@/lib/smolgame-api';

export function useAuth() {
  const [user, setUser] = useState<SmolGameUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = async () => {
    try {
      const userData = await SmolGameAPI.getMe();
      if (userData && userData.id !== 'guest') {
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        throw new Error("Backend returned guest user");
      }
    } catch (error) {
      console.warn("User not authenticated via SmolGame Worker. Enabling Guest Mode.", error);
      setUser({
        id: 'guest',
        username: 'Guest',
        first_name: 'Guest',
        isGithubConnected: false
      });
      setIsAuthenticated(false); // Not authenticated with GitHub/Worker
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();

    // Check on focus or periodic
    const handleFocus = () => checkAuth();
    window.addEventListener('focus', handleFocus);
    
    // Poll every 30s to keep sync with backend
    const interval = setInterval(checkAuth, 30000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      clearInterval(interval);
    };
  }, []);

  const login = async () => {
    try {
      const { url } = await SmolGameAPI.githubOAuthStart();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Failed to start GitHub OAuth", error);
      alert("Не удалось запустить вход через GitHub. Убедись, что ты открыл приложение из Telegram.");
    }
  };

  const logout = async () => {
    try {
      await SmolGameAPI.githubUnlink();
      setUser(null);
      setIsAuthenticated(false);
    } catch (error) {
      console.error("Failed to unlink GitHub", error);
    }
  };

  return {
    user,
    isAuthenticated,
    isLoading,
    login,
    logout,
    refresh: checkAuth,
    isGithubConnected: user?.isGithubConnected || false,
    githubUsername: user?.githubUsername || null,
  };
}
