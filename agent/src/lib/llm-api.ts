
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

export async function* generateStream(
  messages: ChatMessage[],
  config: LLMConfig,
  signal?: AbortSignal
) {
  if (!config.apiKey) {
    throw new Error("API Key is required to use this provider. Please check your settings.");
  }
  let url = "";
  let headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.apiKey}`,
  };
  let body: any = {
    messages,
    stream: true,
  };

  switch (config.provider) {
    case "openrouter":
      url = "https://openrouter.ai/api/v1/chat/completions";
      headers["HTTP-Referer"] = window.location.origin;
      headers["X-Title"] = "HybridAI 2.0";
      body.model = config.model || "deepseek/deepseek-chat";
      break;
    case "groq":
      url = "https://api.groq.com/openai/v1/chat/completions";
      body.model = config.model || "llama3-70b-8192";
      break;
    case "gemini":
      // Gemini API has a different structure, but many tools use OpenAI-compatible proxies
      // or we can implement the native one. Let's stick to OpenAI compatible for now
      // or implement native if needed. OpenRouter covers many.
      // For now, let's treat Gemini as OpenAI compatible if using a proxy, 
      // or implement native if config.provider === 'gemini'.
      url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
      body.model = config.model || "gpt-3.5-turbo"; // Placeholder
      break;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.statusText}`);
  }

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
          console.error("Error parsing stream chunk", e);
        }
      }
    }
  }
}
