/**
 * Unified type exports
 * Import shared types from this single entry point.
 */

export type * from "../drizzle/schema";
export * from "./_core/errors";

/**
 * GameSpec represents all collected information about the game to be generated
 */
export interface GameSpec {
  genre?: string;
  mechanics?: string;
  visuals?: string;
  audience?: string;
  story?: string;
  progression?: string;
  special_features?: string;
}

/**
 * Interview question structure
 */
export interface InterviewQuestion {
  id: string;
  field: keyof GameSpec;
  question: string;
  followUp?: boolean;
}

/**
 * Chat message for the interview flow
 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

/**
 * Game generation result
 */
export interface GameGenerationResult {
  htmlCode: string;
  prompt: string;
  gameSpec: GameSpec;
}
