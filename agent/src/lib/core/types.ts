export interface GameSpec {
  genre: string;
  mechanics: string;
  visuals: string;
  audience: string;
  story: string;
  progression: string;
  special_features: string;
  title?: string;
  description?: string;
}

export type GameSessionPhase = 
  | 'interview'
  | 'generating'
  | 'validating'
  | 'ready_to_test'
  | 'deploying'
  | 'playing'
  | 'editing'
  | 'updating'
  | 'error';
