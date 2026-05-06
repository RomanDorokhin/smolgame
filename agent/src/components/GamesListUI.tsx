/**
 * Games List UI Component
 * Shows all games for user with delete/archive options
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { useLocation } from 'wouter';
import { getUserGamesForUI } from '@/lib/gameFlowOrchestratorV2';
import {
  deleteGameWithConfirmation,
  archiveGame,
  exportGameBeforeDeletion,
  getDeletionConfirmationMessage,
  getArchivalConfirmationMessage,
} from '@/lib/gameDeletionManager';
import './GamesListUI.css';

interface GameCardProps {
  gameId: string;
  title: string;
  genre: string;
  createdAt: Date;
  gameUrl?: string;
  repoUrl?: string;
  phase: string;
  onDelete: (gameId: string) => void;
  onArchive: (gameId: string) => void;
  onExport: (gameId: string) => void;
  onPlay: (gameId: string) => void;
  onContinue: (gameId: string) => void;
}

function GameCard({
  gameId,
  title,
  genre,
  createdAt,
  gameUrl,
  repoUrl,
  phase,
  onDelete,
  onArchive,
  onExport,
  onPlay,
  onContinue,
}: GameCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const getPhaseLabel = (phase: string): string => {
    const labels: Record<string, string> = {
      interview: '📝 Interview',
      generating: '⚙️ Generating',
      validating: '✓ Validating',
      ready_to_test: '🎯 Ready to Test',
      deploying: '🚀 Deploying',
      playing: '▶ Playing',
      editing: '✏️ Editing',
      updating: '📤 Updating',
      error: '❌ Error',
    };
    return labels[phase] || phase;
  };

  const getPhaseColor = (phase: string): string => {
    const colors: Record<string, string> = {
      interview: '#3b82f6',
      generating: '#f59e0b',
      validating: '#10b981',
      ready_to_test: '#8b5cf6',
      deploying: '#ec4899',
      playing: '#06b6d4',
      editing: '#f97316',
      updating: '#6366f1',
      error: '#ef4444',
    };
    return colors[phase] || '#6b7280';
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    const confirmed = confirm(getDeletionConfirmationMessage(title));

    if (confirmed) {
      await onDelete(gameId);
    }

    setIsDeleting(false);
    setShowMenu(false);
  };

  const handleArchive = async () => {
    const confirmed = confirm(getArchivalConfirmationMessage(title));

    if (confirmed) {
      await onArchive(gameId);
    }

    setShowMenu(false);
  };

  const handleExport = async () => {
    await onExport(gameId);
    setShowMenu(false);
  };

  return (
    <div className="game-card">
      <div className="game-card-header">
        <div className="game-card-title">
          <h3>{title}</h3>
          <span className="game-card-genre">{genre}</span>
        </div>
        <div className="game-card-menu">
          <button
            className="menu-button"
            onClick={() => setShowMenu(!showMenu)}
            disabled={isDeleting}
          >
            ⋮
          </button>
          {showMenu && (
            <div className="menu-dropdown">
              <button onClick={handleExport} className="menu-item">
                📥 Export Backup
              </button>
              <button onClick={handleArchive} className="menu-item">
                📦 Archive
              </button>
              <button
                onClick={handleDelete}
                className="menu-item menu-item-danger"
                disabled={isDeleting}
              >
                {isDeleting ? '🗑️ Deleting...' : '🗑️ Delete'}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="game-card-info">
        <div className="info-item">
          <span className="label">Status:</span>
          <span
            className="status-badge"
            style={{ backgroundColor: getPhaseColor(phase) }}
          >
            {getPhaseLabel(phase)}
          </span>
        </div>
        <div className="info-item">
          <span className="label">Created:</span>
          <span className="value">{formatDate(createdAt)}</span>
        </div>
      </div>

      <div className="game-card-actions">
        {gameUrl ? (
          <>
            <button className="action-button action-play" onClick={() => onPlay(gameId)}>
              ▶ Play
            </button>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="action-button action-repo"
            >
              📂 Repository
            </a>
          </>
        ) : (
          <button className="action-button action-continue" onClick={() => onContinue(gameId)}>
            📝 Continue
          </button>
        )}
      </div>
    </div>
  );
}

export function GamesListUI() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [games, setGames] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      const gamesList = getUserGamesForUI(user.id.toString());
      setGames(gamesList.games);
      setIsLoading(false);
    }
  }, [user?.id]);

  const handleDelete = async (gameId: string) => {
    if (!user?.id) return;

    await deleteGameWithConfirmation(user.id.toString(), gameId, 'Game', {
      onSuccess: (message) => {
        console.log(message);
        // Refresh games list
        const gamesList = getUserGamesForUI(user.id.toString());
        setGames(gamesList.games);
      },
      onError: (error) => {
        console.error('Deletion error:', error);
        alert(`Failed to delete game: ${error}`);
      },
    });
  };

  const handleArchive = async (gameId: string) => {
    if (!user?.id) return;

    await archiveGame(user.id.toString(), gameId, {
      onSuccess: (message) => {
        console.log(message);
        // Refresh games list
        const gamesList = getUserGamesForUI(user.id.toString());
        setGames(gamesList.games);
      },
      onError: (error) => {
        console.error('Archive error:', error);
        alert(`Failed to archive game: ${error}`);
      },
    });
  };

  const handleExport = async (gameId: string) => {
    if (!user?.id) return;

    const result = await exportGameBeforeDeletion(user.id.toString(), gameId);

    if (result.success) {
      alert('Game exported successfully! Check your downloads.');
    } else {
      alert(`Failed to export game: ${result.error}`);
    }
  };

  const handlePlay = (gameId: string) => {
    const game = games.find(g => g.gameId === gameId);
    if (game?.gameUrl) {
      window.open(game.gameUrl, '_blank');
    }
  };

  const handleContinue = (gameId: string) => {
    setLocation(`/games/${gameId}`);
  };

  const handleCreateNew = () => {
    setLocation('/games/new');
  };

  if (isLoading) {
    return (
      <div className="games-list-container">
        <div className="loading">Loading your games...</div>
      </div>
    );
  }

  return (
    <div className="games-list-container">
      <div className="games-list-header">
        <div className="header-content">
          <h1>🎮 My Games</h1>
          <p>{games.length} game{games.length !== 1 ? 's' : ''}</p>
        </div>
        <button className="create-button" onClick={handleCreateNew}>
          ✨ Create New Game
        </button>
      </div>

      {games.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🎮</div>
          <h2>No games yet</h2>
          <p>Create your first game and start building!</p>
          <button className="create-button-large" onClick={handleCreateNew}>
            ✨ Create Your First Game
          </button>
        </div>
      ) : (
        <div className="games-grid">
          {games.map(game => (
            <GameCard
              key={game.gameId}
              gameId={game.gameId}
              title={game.title}
              genre={game.genre}
              createdAt={game.createdAt}
              gameUrl={game.gameUrl}
              repoUrl={game.repoUrl}
              phase={game.phase}
              onDelete={handleDelete}
              onArchive={handleArchive}
              onExport={handleExport}
              onPlay={handlePlay}
              onContinue={handleContinue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default GamesListUI;
