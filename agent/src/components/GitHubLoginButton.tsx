import React from 'react';
import { GitHubOAuthClient, type GitHubUser } from '@/lib/githubOAuthClient';

interface GitHubLoginButtonProps {
  clientId: string;
  onLoginSuccess: (user: GitHubUser) => void;
  onLoginError: (error: string) => void;
  onLogout: () => void;
}

export const GitHubLoginButton: React.FC<GitHubLoginButtonProps> = ({
  clientId,
}) => {
  const handleLogin = () => {
    const client = new GitHubOAuthClient({
      clientId,
      redirectUri: `${window.location.origin}/auth/github/callback`,
    });
    window.location.href = client.getAuthorizationUrl();
  };

  return (
    <div className="github-login-container">
      <button className="github-login-button" onClick={handleLogin}>
        <span className="github-icon">🐙</span>
        Connect with GitHub
      </button>
      <p className="github-login-note">
        Required for instant deployment to GitHub Pages
      </p>
    </div>
  );
};

export default GitHubLoginButton;
