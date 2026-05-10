import { useState, useCallback, useRef, useEffect } from "react";
import { generateStream, LLMConfig } from "@/lib/llm-api";
import { SmolGameAPI } from "@/lib/smolgame-api";
import type { APIProvider, ChatSettings } from "@/types/chat";
import { pool } from "@/lib/llm-api";
import { INTERVIEWER_PROMPT, AIDER_EDITOR_PROMPT } from "./agent_prompts";
import { generateGame } from "@/lib/sep/gameGenerationPipelinePro";
import { analyzeGameCode } from "@/lib/sep/game-code-analyzer";

// ──────────────────────────────────────────────
// ТИПЫ
// ──────────────────────────────────────────────
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  gameCode?: string;
  timestamp: number;
  isStreaming?: boolean;
  progress?: number;
  deployState?: {
    phase: "idle" | "deploying" | "waiting_pages" | "ready" | "error";
    status?: string;
    pagesUrl?: string;
    repoUrl?: string;
    attempt?: number;
    maxAttempts?: number;
    error?: string;
  };
}

const FALLBACK_ORDER: APIProvider[] = ["openrouter", "groq", "gemini", "together", "deepseek", "sambanova", "glhf"];

const DEFAULT_MODELS: Record<string, string[]> = {
  openrouter: ["anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001"],
  groq: ["llama-3.3-70b-versatile"],
  gemini: ["gemini-2.0-flash"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  deepseek: ["deepseek-chat"],
  sambanova: ["Meta-Llama-3.1-70B-Instruct"],
  glhf: ["hf:meta-llama/Llama-3.1-70B-Instruct"],
  huggingface: ["meta-llama/Llama-3.2-11B-Vision-Instruct"],
};

const makeId = () => Math.random().toString(36).substring(2, 9);

const safeStorage = {
  set: (key: string, val: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_e) {}
  },
  get: <T>(key: string, defaultVal: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultVal;
    } catch (_e) { return defaultVal; }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch (_e) {}
  }
};

function parseAiderBlocks(text: string): { search: string; replace: string }[] {
  const blocks: { search: string; replace: string }[] = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }
  return blocks;
}

function applyAiderBlocks(code: string, blocks: { search: string; replace: string }[]): { code: string; applied: number } {
  let result = code;
  let applied = 0;
  for (const block of blocks) {
    if (result.includes(block.search)) {
      result = result.replace(block.search, block.replace);
      applied++;
    }
  }
  return { code: result, applied };
}

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    safeStorage.get<AgentMessage[]>("smol_agent_messages_v1", [])
  );
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const [targetRepo, setTargetRepo] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatHistory = useRef<{ role: "user" | "assistant" | "system"; content: string }[]>(
    safeStorage.get("smol_agent_history_v1", [])
  );

  useEffect(() => {
    safeStorage.set("smol_agent_messages_v1", messages);
    safeStorage.set("smol_agent_history_v1", chatHistory.current);
  }, [messages]);

  const addMessage = useCallback((msg: Omit<AgentMessage, "id" | "timestamp">) => {
    const full: AgentMessage = { ...msg, id: makeId(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<AgentMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const getActiveProviders = useCallback(() => {
    return FALLBACK_ORDER.filter(p => {
      const key = settings.keys[p as keyof typeof settings.keys] as string | undefined;
      return key && key.trim().length > 0;
    });
  }, [settings]);

  const getLLMConfig = useCallback((provider: string): LLMConfig => {
    const apiKey = settings.keys[provider as keyof typeof settings.keys] as string;
    let model = (settings.models?.[provider as keyof typeof settings.models] as string | undefined)
      || DEFAULT_MODELS[provider]?.[0] || "gpt-3.5-turbo";
      
    // FIX: Auto-correct cached invalid model names from localStorage
    if (model === "anthropic/claude-3-5-sonnet") {
      model = "anthropic/claude-3.5-sonnet";
    }
      
    return { provider: provider as any, apiKey, model };
  }, [settings]);

  const streamWithFallback = useCallback(async (
    msgs: { role: "user" | "assistant" | "system"; content: string }[],
    onChunk: (chunk: string, full: string) => void,
    signal: AbortSignal,
    preferredProvider?: string
  ): Promise<{ text: string; provider: string }> => {
    const active = getActiveProviders();
    if (active.length === 0) throw new Error("NO_KEYS");

    const ordered = preferredProvider && active.includes(preferredProvider as APIProvider)
      ? [preferredProvider as APIProvider, ...active.filter(p => p !== preferredProvider)]
      : active;

    let lastError = "";
    for (let i = 0; i < ordered.length; i++) {
      const providerId = ordered[i];
      if (signal.aborted) throw new Error("Cancelled");

      const status = pool.getStatus(providerId);
      if (status.state === "OPEN") continue;

      const config = getLLMConfig(providerId);

      try {
        if (i > 0) setStep(`🔄 Переключаюсь на ${providerId.toUpperCase()}...`);

        let fullText = "";
        const stream = generateStream(msgs, config, signal);

        for await (const chunk of stream) {
          if (signal.aborted) break;
          fullText += chunk;
          onChunk(chunk, fullText);
        }

        pool.reportSuccess(providerId);
        return { text: fullText, provider: providerId };
      } catch (e: unknown) {
        lastError = (e as Error).message || "Unknown";
        const isRate = lastError.includes("429") || lastError.toLowerCase().includes("rate limit");
        pool.reportFailure(providerId, isRate, lastError);
        if (i === ordered.length - 1) break;
      }
    }
    const detailedError = lastError === "Load failed" 
      ? "Ошибка сети (CORS или недоступен сервер). Проверьте ключи в настройках." 
      : lastError;
    throw new Error(`Все провайдеры недоступны. Последняя ошибка: ${detailedError}`);
  }, [settings, getActiveProviders, getLLMConfig]);

  const sendMessage = useCallback(async (userText: string, repoToUpdate?: string) => {
    if (isRunning) return;

    if (repoToUpdate) setTargetRepo(repoToUpdate);

    const lastCodeMessage = [...messages].reverse().find(m => m.role === "assistant" && m.gameCode);

    addMessage({ role: "user", content: userText });
    chatHistory.current.push({ role: "user", content: userText });

    const assistantId = addMessage({ role: "assistant", content: "🤔 ...", isStreaming: true });
    setIsRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const activeProviders = getActiveProviders();
    if (activeProviders.length === 0) {
      updateMessage(assistantId, {
        content: "❌ Нет API ключей. Открой настройки (≡) и добавь хотя бы один ключ.",
        isStreaming: false,
      });
      setIsRunning(false);
      return;
    }

    try {
      setStep("🚀 Генерация...");
      
      const generateWithFallback = async (msgs: any[]) => {
        const result = await streamWithFallback(msgs, (chunk, full) => {
          updateMessage(assistantId, { content: full, isStreaming: true });
        }, signal);
        return result.text;
      };

      const result = await generateGame(userText, {
        generateFn: generateWithFallback,
        previousCode: lastCodeMessage?.gameCode
      });

      if (result.isSuccess && result.generatedCode) {
        let finalCode = result.generatedCode.trim();
        
        // Aider logic: Apply blocks if they exist
        const blocks = parseAiderBlocks(finalCode);
        if (blocks.length > 0 && lastCodeMessage?.gameCode) {
          const applied = applyAiderBlocks(lastCodeMessage.gameCode, blocks);
          finalCode = applied.code;
        } else {
          // Clean up markdown markers if it's a full file
          finalCode = finalCode.replace(/```[a-z]*\n/gi, '').replace(/```/g, '').trim();
        }

        updateMessage(assistantId, {
          content: finalCode,
          gameCode: finalCode,
          isStreaming: false,
          deployState: { phase: "ready", status: "Готово", pagesUrl: "" }
        });
        chatHistory.current.push({ role: "assistant", content: finalCode });
      } else {
        throw new Error(result.errors.join("\n") || "Ошибка генерации.");
      }

    } catch (e: unknown) {
      updateMessage(assistantId, { content: `❌ Ошибка: ${(e as Error).message}`, isStreaming: false });
    } finally {
      setIsRunning(false);
      setStep("");
      setTargetRepo(null);
    }
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, getLLMConfig, streamWithFallback, messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStep("");
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    chatHistory.current = [];
    safeStorage.remove("smol_agent_messages_v1");
    safeStorage.remove("smol_agent_history_v1");
  }, []);

  const debugGame = useCallback(async (currentCode: string) => {
    if (isRunning) return;
    setIsRunning(true);
    setStep("🔍 Поиск багов...");
    const assistantId = addMessage({ role: "assistant", content: "🔍 Анализирую код на наличие ошибок...", isStreaming: true });
    
    try {
      const abortController = new AbortController();
      const signal = abortController.signal;

      // ШАГ 1: Найти баги
      const { text: bugReport } = await streamWithFallback(
        [
          { role: "system", content: "ЭТО ИГРА ДОЛЖНА БЫТЬ НА МИРОВОМ УРОВНЕ без тебя мы не справимся НАЙДИ ВСЕ БАГИ В ЭТОЙ ИГРЕ И КОРОТКО пришли только план по исправлению БЕЗ ЛИШНИХ КОММЕНТАРИЕВ ЭТО ВАЖНО" },
          { role: "user", content: `КОД ДЛЯ АНАЛИЗА:\n\n${currentCode}` }
        ],
        (chunk, full) => {
           updateMessage(assistantId, { content: `🔍 Анализ багов...\n\n` + full, isStreaming: true });
        },
        signal
      );

      setStep("🛠 Исправление...");
      updateMessage(assistantId, { content: `**План исправления:**\n${bugReport}\n\n🛠 **Начинаю исправление...**`, isStreaming: true });

      // ШАГ 2: Исправить баги по плану
      const { text: fixedCodeResponse } = await streamWithFallback(
        [
          { role: "system", content: "ЭТО ИГРА ДОЛЖНА СТАТЬ КУЛЬТОВОЙ ВО ВСЕМ МИРЕ. Твоя задача: ПОЛНОСТЬЮ РЕАЛИЗОВАТЬ ПЛАН ИСПРАВЛЕНИЯ, обновить визуал до премиального уровня и выдать ГОТОВЫЙ ПОЛНЫЙ КОД БЕЗ КОММЕНТАРИЕВ. Ценим твой вклад." },
          { role: "user", content: `ПЛАН ДЕЙСТВИЙ:\n${bugReport}\n\nТЕКУЩИЙ КОД:\n${currentCode}` }
        ],
        (chunk, full) => {
           updateMessage(assistantId, { content: `🛠 Исправляю баги на основе плана...\n\n` + full, isStreaming: true });
        },
        signal
      );

      let finalCode = fixedCodeResponse.replace(/```[a-z]*\n/gi, '').replace(/```/g, '').trim();
      const match = finalCode.match(/<html[\s\S]*<\/html>/i);
      if (match) finalCode = match[0];

      updateMessage(assistantId, {
        content: finalCode,
        gameCode: finalCode,
        isStreaming: false,
        deployState: { phase: "ready", status: "Исправлено", pagesUrl: "" }
      });

    } catch (e: unknown) {
      updateMessage(assistantId, { content: `❌ Ошибка отладки: ${(e as Error).message}`, isStreaming: false });
    } finally {
      setIsRunning(false);
      setStep("");
    }
  }, [isRunning, addMessage, updateMessage, streamWithFallback]);

  return { messages, isRunning, step, sendMessage, stop, reset, debugGame };
}
