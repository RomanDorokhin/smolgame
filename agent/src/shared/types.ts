export interface User {
  id: string;
  name: string;
  email: string;
}

export interface GameData {
  gameId: string;
  userId: string;
  htmlCode: string;
  metadata: Record<string, unknown>;
}
