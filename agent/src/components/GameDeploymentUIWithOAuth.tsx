/**
 * Game Deployment UI with OAuth
 * Handles deployment using OAuth-authenticated GitHub access
 */

import { useState, useEffect } from 'react';
import {
  quickDeployGameOAuth,
  type DeploymentResult,
  type GameMetadata,
} from '@/lib/githubGameDeployerOAuth';
import { GitHubOAuthClient, type GitHubUser } from '@/lib/githubOAuthClient';
import GitHubLoginButton from './GitHubLoginButton';
import './GameDeploymentUI.css';

interface GameDeploymentUIWithOAuthProps {
  htmlCode: string;
  gameSpec: {
    genre?: string;
    mechanics?: string;
    story?: string;
    visuals?: string;
  };
  githubClientId: string;
  onDeploymentComplete?: (result: DeploymentResult) => void;
}

export const GameDeploymentUIWithOAuth: React.FC<GameDeploymentUIWithOAuthProps> = ({
  htmlCode,
  gameSpec,
  githubClientId,
  onDeploymentComplete,
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentResult, setDeploymentResult] = useState<DeploymentResult | null>(null);
  const [deploymentProgress, setDeploymentProgress] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [error, setError] = useState('');

  // Check authentication status
  useEffect(() => {
    const token = GitHubOAuthClient.getToken();
    const storedUser = GitHubOAuthClient.getUser();

    if (token && storedUser) {
      setIsAuthenticated(true);
      setUser(storedUser);
    }
  }, []);

  const handleLoginSuccess = (userData: GitHubUser) => {
    setIsAuthenticated(true);
    setUser(userData);
    setError('');
  };

  const handleLoginError = (errorMessage: string) => {
    setError(errorMessage);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setDeploymentResult(null);
  };

  const handleDeploy = async () => {
    if (!isAuthenticated || !user) {
      setError('Please connect GitHub first');
      return;
    }

    setIsDeploying(true);
    setError('');
    setDeploymentProgress('');
    setProgressPercent(0);

    try {
      const gameTitle = gameSpec.genre || 'Untitled Game';
      const metadata: GameMetadata = {
        title: gameTitle,
        genre: gameSpec.genre || 'Unknown',
        description: gameSpec.mechanics || 'A fun game created with OpenSmolGame',
        author: user.login,
        createdAt: new Date(),
        version: '1.0.0',
      };

      const result = await quickDeployGameOAuth(htmlCode, metadata, (message, progress) => {
        setDeploymentProgress(message);
        setProgressPercent(progress);
      });

      setDeploymentResult(result);

      if (result.success && onDeploymentComplete) {
        onDeploymentComplete(result);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Deployment failed';
      setError(errorMessage);
    } finally {
      setIsDeploying(false);
    }
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="deployment-ui">
        <GitHubLoginButton
          clientId={githubClientId}
          onLoginSuccess={handleLoginSuccess}
          onLoginError={handleLoginError}
          onLogout={handleLogout}
        />
      </div>
    );
  }

  // Deployment successful
  if (deploymentResult) {
    if (deploymentResult.success) {
      return (
        <div className="deployment-ui deployment-success">
          <div className="success-header">
            <div className="success-icon">🎉</div>
            <h3>Game Deployed Successfully!</h3>
          </div>

          <div className="deployment-info">
            <div className="info-block">
              <label>Play Your Game:</label>
              <div className="game-link-container">
                <a
                  href={deploymentResult.gameUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="game-link"
                >
                  {deploymentResult.gameUrl}
                </a>
                <button
                  className="copy-button"
                  onClick={() => {
                    navigator.clipboard.writeText(deploymentResult.gameUrl);
                  }}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>

            <div className="info-block">
              <label>GitHub Repository:</label>
              <div className="repo-link-container">
                <a
                  href={deploymentResult.repositoryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="repo-link"
                >
                  {deploymentResult.repositoryUrl}
                </a>
                <button
                  className="copy-button"
                  onClick={() => {
                    navigator.clipboard.writeText(deploymentResult.repositoryUrl);
                  }}
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>
            </div>

            <div className="info-block">
              <label>Deployment Time:</label>
              <p>{deploymentResult.deploymentTime}s</p>
            </div>
          </div>

          <div className="deployment-actions">
            <a
              href={deploymentResult.gameUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button action-button-play"
            >
              ▶ Play Now
            </a>
            <a
              href={deploymentResult.repositoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button action-button-repo"
            >
              📂 View Repository
            </a>
            <button
              className="action-button action-button-share"
              onClick={() => {
                const shareText = `Check out my game: ${deploymentResult.gameUrl}`;
                if (navigator.share) {
                  navigator.share({
                    title: 'My Game',
                    text: shareText,
                    url: deploymentResult.gameUrl,
                  });
                } else {
                  navigator.clipboard.writeText(shareText);
                }
              }}
            >
              🔗 Share
            </button>
            <button
              className="action-button action-button-new"
              onClick={() => {
                setDeploymentResult(null);
              }}
            >
              ✨ Create New Game
            </button>
          </div>

          <div className="deployment-note">
            <strong>💡 Tip:</strong> Share the game link with anyone! They can play it directly in their browser.
          </div>
        </div>
      );
    } else {
      return (
        <div className="deployment-ui deployment-error">
          <div className="error-header">
            <div className="error-icon">❌</div>
            <h3>Deployment Failed</h3>
          </div>

          <div className="error-message">
            <p>{deploymentResult.message}</p>
          </div>

          <button
            className="action-button action-button-retry"
            onClick={() => {
              setDeploymentResult(null);
              handleDeploy();
            }}
          >
            🔄 Retry
          </button>
        </div>
      );
    }
  }

  // Ready to deploy
  return (
    <div className="deployment-ui deployment-ready">
      <div className="deployment-header">
        <h3>🚀 Deploy to GitHub Pages</h3>
        <p>Your game will be playable instantly via a public link</p>
      </div>

      {isDeploying ? (
        <div className="deployment-progress">
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${progressPercent}%` }}></div>
          </div>
          <p className="progress-text">{deploymentProgress}</p>
          <p className="progress-percent">{progressPercent}%</p>
        </div>
      ) : (
        <>
          <div className="deployment-benefits">
            <div className="benefit">
              <span className="benefit-icon">⚡</span>
              <span>Instant hosting on GitHub Pages</span>
            </div>
            <div className="benefit">
              <span className="benefit-icon">🌍</span>
              <span>Public shareable link</span>
            </div>
            <div className="benefit">
              <span className="benefit-icon">🔓</span>
              <span>No backend required</span>
            </div>
            <div className="benefit">
              <span className="benefit-icon">📱</span>
              <span>Works on all devices</span>
            </div>
          </div>

          {error && <div className="deployment-error-message">{error}</div>}

          <button
            className="action-button action-button-deploy"
            onClick={handleDeploy}
            disabled={isDeploying}
          >
            🚀 Deploy Game
          </button>

          <button
            className="action-button action-button-logout"
            onClick={handleLogout}
          >
            🔓 Disconnect GitHub
          </button>
        </>
      )}
    </div>
  );
};

export default GameDeploymentUIWithOAuth;
