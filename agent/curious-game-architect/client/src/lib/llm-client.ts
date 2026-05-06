
export type APIProvider = "openrouter" | "groq" | "gemini";

export interface LLMConfig {
  provider: APIProvider;
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const SETTINGS_KEY = "hybrid-chat-settings";

export function getLLMSettings(): LLMConfig {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error("Failed to parse settings", e);
  }
  return {
    provider: "openrouter",
    apiKey: "",
    model: "deepseek/deepseek-chat",
  };
}

export async function callLLM(messages: ChatMessage[], config: LLMConfig): Promise<string> {
  let url = "";
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };
  let body: any = {
    messages,
    stream: false,
  };

  switch (config.provider) {
    case "openrouter":
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "OpenSmolGame Architect";
      body.model = config.model || "deepseek/deepseek-chat";
      break;
    case "groq":
      url = "https://api.groq.com/openai/v1/chat/completions";
      body.model = config.model || "llama3-70b-8192";
      break;
    case "gemini":
      url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
      body.model = config.model || "gemini-1.5-flash";
      break;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
}
