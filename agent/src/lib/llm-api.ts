export type APIProvider = "openrouter" | "groq" | "gemini" | "deepseek" | "huggingface" | "mistral" | "custom";

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
}

const CIRCUIT_BREAKER_COOLDOWN = 60 * 1000; // 1 minute
const MAX_FAILURES = 2;

class ProviderPool {
  private statuses: Record<string, ProviderStatus> = {};

  getStatus(provider: string): ProviderStatus {
    if (!this.statuses[provider]) {
      this.statuses[provider] = { state: "CLOSED", nextRetryAt: 0, failureCount: 0 };
    }
    const status = this.statuses[provider];
    if (status.state === "OPEN" && Date.now() >= status.nextRetryAt) {
      status.state = "HALF_OPEN";
    }
    return status;
  }

  reportSuccess(provider: string) {
    const status = this.getStatus(provider);
    status.state = "CLOSED";
    status.failureCount = 0;
  }

  reportFailure(provider: string, isRateLimit: boolean) {
    const status = this.getStatus(provider);
    status.failureCount++;
    if (isRateLimit || status.failureCount >= MAX_FAILURES) {
      status.state = "OPEN";
      status.nextRetryAt = Date.now() + CIRCUIT_BREAKER_COOLDOWN;
      console.warn(`[Orchestrator] Provider ${provider} is now OPEN (Rate limited or failed)`);
    }
  }
}

export const pool = new ProviderPool();

const PROVIDER_URLS: Record<string, string> = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/v1/chat/completions",
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: "deepseek/deepseek-chat",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  mistral: "codestral-latest",
  deepseek: "deepseek-chat",
  custom: "gpt-3.5-turbo",
};

export async function* generateStream(
  messages: ChatMessage[],
  config: LLMConfig,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const status = pool.getStatus(config.provider);
  if (status.state === "OPEN") {
    throw new Error(`Provider ${config.provider} is temporarily disabled due to rate limits.`);
  }

  if (!config.apiKey) {
    throw new Error(`API Key for ${config.provider} is missing.`);
  }

  let url = PROVIDER_URLS[config.provider] || PROVIDER_URLS.openrouter;
  if (config.provider === "custom" && config.baseUrl) {
    url = config.baseUrl;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };

  if (config.provider === "openrouter") {
    headers["HTTP-Referer"] = window.location.origin;
    headers["X-Title"] = "Smol Architect";
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
    const isRateLimit = response.status === 429;
    pool.reportFailure(config.provider, isRateLimit);
    
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error (${response.status}): ${response.statusText}`);
  }

  pool.reportSuccess(config.provider);

  const reader = response.body?.getReader();
  if (!reader) throw new Error("Response body is null");

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
      }
    }
  }
}
