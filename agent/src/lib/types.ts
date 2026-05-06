export interface GameSessionPhase {
  phase: 'interview' | 'generation' | 'validation' | 'testing' | 'deployment';
  status: 'pending' | 'in_progress' | 'complete' | 'failed';
  timestamp: Date;
}

export interface GameMetadata {
  gameId: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  repoName?: string;
  repoUrl?: string;
}

export interface GameSession {
  userId: string;
  gameId: string;
  title: string;
  description: string;
  genre: string;
  mechanics: string;
  difficulty: string;
  theme: string;
  specialFeatures: string;
  gameCode: string;
  phases: GameSessionPhase[];
  metadata: GameMetadata;
}
