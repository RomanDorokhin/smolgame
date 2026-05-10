export type APIProvider = "smolbackend" | "openrouter" | "groq" | "gemini" | "together" | "sambanova" | "glhf" | "huggingface" | "deepseek" | "custom" | "mistral";

export interface LLMConfig {
  provider: APIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

// Circuit Breaker State
interface ProviderStatus {
  state: "CLOSED" | "OPEN" | "HALF_OPEN";
  nextRetryAt: number;
  failureCount: number;
  lastError?: string;
}

const CIRCUIT_BREAKER_COOLDOWN_ERROR = 30 * 1000;       // 30s for generic errors
const CIRCUIT_BREAKER_COOLDOWN_RATE_LIMIT = 30 * 1000; // 30s for 429
const MAX_FAILURES = 3;

class ProviderPool {
  private statuses: Record<string, ProviderStatus> = {};

  getStatus(provider: string): ProviderStatus {
    if (!this.statuses[provider]) {
      this.statuses[provider] = { state: "CLOSED", nextRetryAt: 0, failureCount: 0 };
    }
    const status = this.statuses[provider];
    if (status.state === "OPEN" && Date.now() >= status.nextRetryAt) {
      status.state = "HALF_OPEN";
      console.log(`[CircuitBreaker] ${provider} entering HALF_OPEN state`);
    }
    return status;
  }

  reportSuccess(provider: string) {
    const status = this.getStatus(provider);
    status.state = "CLOSED";
    status.failureCount = 0;
    status.lastError = undefined;
  }

  reportFailure(provider: string, isRateLimit: boolean, errorMessage?: string) {
    const status = this.getStatus(provider);
    status.failureCount++;
    status.lastError = errorMessage;
    if (isRateLimit || status.failureCount >= MAX_FAILURES) {
      status.state = "OPEN";
      const cooldown = isRateLimit ? CIRCUIT_BREAKER_COOLDOWN_RATE_LIMIT : CIRCUIT_BREAKER_COOLDOWN_ERROR;
      status.nextRetryAt = Date.now() + cooldown;
      const cooldownSec = Math.round(cooldown / 1000);
      console.warn(`[CircuitBreaker] ${provider} → OPEN (${isRateLimit ? 'rate limited' : 'errors'}) for ${cooldownSec}s`);
    }
  }

  reset(provider: string) {
    const status = this.getStatus(provider);
    status.state = "CLOSED";
    status.failureCount = 0;
    status.nextRetryAt = 0;
  }

  /** Returns a human-readable status string for all providers */
  getSummary(providers: string[]): string {
    return providers.map(p => {
      const s = this.getStatus(p);
      if (s.state === "CLOSED") return `${p}: ✅`;
      if (s.state === "HALF_OPEN") return `${p}: 🟡`;
      const secondsLeft = Math.max(0, Math.round((s.nextRetryAt - Date.now()) / 1000));
      return `${p}: ❌ (${secondsLeft}s)`;
    }).join(' | ');
  }
}

export const pool = new ProviderPool();

const PROVIDER_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  together: "https://api.together.xyz/v1/chat/completions",
  sambanova: "https://api.sambanova.ai/v1/chat/completions",
  glhf: "https://glhf.chat/api/openai/v1/chat/completions",
  huggingface: "https://api-inference.huggingface.co/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
};

const MODELS_LIST_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/models",
  groq: "https://api.groq.com/openai/v1/models",
  together: "https://api.together.xyz/v1/models",
};

export const DEFAULT_MODELS: Record<string, string[]> = {
  openrouter: ["anthropic/claude-3.7-sonnet", "google/gemini-2.0-flash-001", "google/gemini-2.0-pro-exp-02-05:free"],
  groq: ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile"],
  gemini: ["gemini-2.0-flash", "gemini-2.0-flash-lite-preview-02-05", "gemini-1.5-flash"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "meta-llama/Llama-3.1-70B-Instruct-Turbo"],
  sambanova: ["Meta-Llama-3.3-70B-Instruct", "Meta-Llama-3.1-70B-Instruct-Reference"],
  glhf: ["hf:meta-llama/Llama-3.1-405B-Instruct", "hf:meta-llama/Llama-3.3-70B-Instruct"],
  huggingface: ["meta-llama/Llama-3.2-11B-Vision-Instruct", "Qwen/Qwen2.5-72B-Instruct"],
  deepseek: ["deepseek-chat"],
  custom: ["gpt-3.5-turbo"],
};

export interface ModelInfo {
  id: string;
  name: string;
  isFree: boolean;
  provider: APIProvider;
  contextLength?: number;
}

/** Fetches available models from a provider's API */
export async function fetchAvailableModels(provider: APIProvider, apiKey: string): Promise<ModelInfo[]> {
  const url = MODELS_LIST_URLS[provider];
  if (!url || !apiKey) return [];

  try {
    const response = await fetch(url, {
      headers: { "Authorization": `Bearer ${apiKey}` }
    });
    if (!response.ok) return [];
    const data = await response.json();

    if (provider === "openrouter") {
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.name,
        isFree: m.pricing?.prompt === "0" && m.pricing?.completion === "0",
        provider: "openrouter",
        contextLength: m.context_length
      }));
    }

    if (provider === "groq" || provider === "together") {
      return data.data.map((m: any) => ({
        id: m.id,
        name: m.id,
        isFree: false, // Groq/Together don't explicitly mark free, but their API is often free-tier based
        provider,
      }));
    }

    return [];
  } catch (e) {
    console.error(`Failed to fetch models for ${provider}`, e);
    return [];
  }
}

export async function* generateStream(
  messages: ChatMessage[],
  config: LLMConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  // --- SMOLBACKEND PROXY (SECURE) ---
  if (config.provider === "smolbackend") {
    const { SmolGameAPI } = await import("./smolgame-api");
    const stream = SmolGameAPI.chatStream({
      messages,
      provider: "openai", // Default internal provider on worker
      model: config.model || "gpt-4o",
    }, signal);

    for await (const chunk of stream) {
      // The backend returns SSE (data: ...) for OpenAI
      const lines = chunk.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          if (trimmed === "data: [DONE]") continue;
          try {
            const json = JSON.parse(trimmed.substring(6));
            const content = json.choices[0]?.delta?.content || "";
            if (content) yield content;
          } catch (e) {}
        }
      }
    }
    return;
  }

  const status = pool.getStatus(config.provider);
  if (status.state === "OPEN") {
    throw new Error(`Provider ${config.provider} is temporarily disabled due to rate limits.`);
  }

  if (!config.apiKey || config.apiKey.trim().length === 0) {
    throw new Error(`API Key for ${config.provider} is empty or invalid.`);
  }

  let url = PROVIDER_URLS[config.provider] || PROVIDER_URLS.openrouter;
  if (config.provider === "gemini") {
    url = `${url}?key=${config.apiKey}`;
  }
  
  if (config.provider === "custom" && config.baseUrl) {
    url = config.baseUrl;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.provider !== "gemini") {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "agent-smol";
  }

  const body = {
    messages,
    stream: true,
    model: config.model || DEFAULT_MODELS[config.provider] || "gpt-3.5-turbo",
  };

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    const isRateLimit = response.status === 429;
    pool.reportFailure(config.provider, isRateLimit, errorText);
    throw new Error(`API Error ${response.status}: ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("API returned an empty body (No Stream Reader)");
  }

  pool.reportSuccess(config.provider);

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine === "data: [DONE]") continue;

      if (trimmedLine.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmedLine.substring(6));
          const content = json.choices[0]?.delta?.content || "";
          if (content) yield content;
        } catch (e) {
          // Ignore parsing errors for empty chunks
        }
      } else if (trimmedLine.startsWith("{") && trimmedLine.includes('"error"')) {
        try {
          const json = JSON.parse(trimmedLine);
          if (json.error) {
            throw new Error(json.error.message || JSON.stringify(json.error));
          }
        } catch (e) {
          if (e instanceof Error && e.message !== "Unexpected end of JSON input" && !e.message.includes("Unexpected token")) {
            throw e;
          }
        }
      }
    }
  }
}

export async function generateText(
  prompt: string,
  config: LLMConfig,
  systemPrompt: string = "You are a helpful AI assistant."
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ];

  let fullText = "";
  for await (const chunk of generateStream(messages, config)) {
    fullText += chunk;
  }
  return fullText;
}
