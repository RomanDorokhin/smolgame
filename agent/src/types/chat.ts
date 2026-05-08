export type ChatRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  pipelineResult?: any;
  status?: string;
  isHidden?: boolean;
}

export interface ModelProgress {
  progress: number;
  text: string;
  status: "idle" | "downloading" | "loading" | "ready" | "error";
}

export type APIProvider = "openrouter" | "groq" | "gemini" | "together" | "sambanova" | "glhf" | "huggingface" | "deepseek" | "custom";

export interface ChatSettings {
  primaryProvider: APIProvider;
  keys: Partial<Record<APIProvider, string>>;
  models: Partial<Record<APIProvider, string>>;
  customBaseUrl?: string;
  autoFailover: boolean;
  maxRetries: number;
}

export interface UsageStats {
  requests: Record<string, number>; // provider: count
  lastReset: number;
}

export type ThemeMode = "dark" | "light";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  modelName: string;
  retryCount?: number;
  isPipelineRunning?: boolean;
  pipelineStep?: string;
  editTarget?: {
    repo: string;
    path: string;
    sha: string;
    originalCode: string;
    currentCode: string;
  };
}
