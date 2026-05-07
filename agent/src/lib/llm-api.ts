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
  lastError?: string;
}

const CIRCUIT_BREAKER_COOLDOWN_ERROR = 60 * 1000;       // 1 min for generic errors
const CIRCUIT_BREAKER_COOLDOWN_RATE_LIMIT = 5 * 60 * 1000; // 5 min for 429
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
};

const DEFAULT_MODELS: Record<string, string> = {
  openrouter: "google/gemini-2.0-flash-exp:free",
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  sambanova: "Meta-Llama-3.1-70B-Instruct",
  glhf: "hf:meta-llama/Llama-3.1-405B-Instruct",
  huggingface: "meta-llama/Llama-3.2-11B-Vision-Instruct",
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
    const error = await response.json().catch(() => ({}));
    const errorMsg = error.error?.message || `API error (${response.status}): ${response.statusText}`;
    pool.reportFailure(config.provider, isRateLimit, errorMsg);
    throw new Error(errorMsg);
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
