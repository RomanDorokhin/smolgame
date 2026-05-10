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

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "openrouter", "together", "deepseek", "huggingface"];

const DEFAULT_MODELS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile"],
  gemini: ["gemini-2.0-flash"],
  openrouter: ["google/gemini-2.0-flash-001"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  deepseek: ["deepseek-chat"],
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
    const model = (settings.models?.[provider as keyof typeof settings.models] as string | undefined)
      || DEFAULT_MODELS[provider]?.[0] || "gpt-3.5-turbo";
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
    throw new Error(`All providers failed. Last: ${lastError}`);
  }, [settings, getActiveProviders, getLLMConfig]);

  const sendMessage = useCallback(async (userText: string, repoToUpdate?: string) => {
    if (isRunning) return;

    if (repoToUpdate) setTargetRepo(repoToUpdate);

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
      // ── PHASE 1: INTERVIEWER ────────────────────────────
      setStep("💬 Думаю...");
      const interviewMsgs = [
        { role: "system" as const, content: INTERVIEWER_PROMPT },
        ...chatHistory.current.slice(-15),
      ];

      const stripPromptTag = (text: string) =>
        text
          .replace(/<plan>([\s\S]*?)<\/plan>/gi, "")
          .replace(/<\/?plan>/gi, "")
          .replace(/plan[\s\S]*/i, "")
          .trim();

      const { text: interviewText, provider: usedProvider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;
          const hasTag = /<plan>/i.test(full) || /plan/i.test(full);
          const visible = stripPromptTag(full);
          updateMessage(assistantId, {
            content: hasTag ? (visible || "🚀 ТЗ собрано! Подключаю команду агентов SEP...") : (visible || "🤔 ..."),
            isStreaming: true,
          });
        },
        signal
      );

      chatHistory.current.push({ role: "assistant", content: interviewText });

      const promptMatch =
        interviewText.match(/<plan>([\s\S]*?)<\/plan>/i) ||
        interviewText.match(/<plan>([\s\S]*?)$/i) ||
        interviewText.match(/plan\s*([\s\S]+)/i);

      const isDetailedRequest = userText.length > 100 && (userText.includes("создай") || userText.includes("игру"));

      if (!promptMatch && !isDetailedRequest) {
        const visible = stripPromptTag(interviewText) || interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible, isStreaming: false });
        setIsRunning(false);
        return;
      }

      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      const tagStart = interviewText.search(/<plan>|plan/i);
      const beforeTag = tagStart > 0 ? interviewText.slice(0, tagStart).trim() : "";
      const isModification = !!previousCode;

      let finalCode = "";

      if (isModification) {
        setStep("🤖 Редактирую код...");
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `🤖 **Редактирую код...**`,
          isStreaming: true
        });

        const { text: modificationText } = await streamWithFallback(
          [
            { role: "system", content: AIDER_EDITOR_PROMPT + `\n\nCURRENT FILE CONTENT:\n${previousCode}` },
            { role: "user", content: `Modify the code:\n\n${gameSpec}` }
          ],
          () => {},
          signal,
          usedProvider
        );

        const blocks = parseAiderBlocks(modificationText);
        if (blocks.length > 0) {
          finalCode = applyAiderBlocks(previousCode!, blocks).code;
        } else {
          const match = modificationText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || modificationText.match(/<html[\s\S]*<\/html>/i);
          finalCode = match ? (match[1] || match[0]) : previousCode!;
        }
      } else {
        // --- 5-STAGE SEP PIPELINE ---
        setStep("🚀 Запуск SEP Pipeline...");
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 **Подготовка команды агентов SEP...**",
          isStreaming: true,
        });

        // Load golden seeds
        let seedContent = "";
        try {
          // Use absolute path for smol-core.js in the seed
          const resp = await fetch("/golden_seeds/ultimate-runner-seed.html");
          seedContent = await resp.text();
          seedContent = seedContent.replace('src="js/smol-core/smol-core.js"', 'src="https://smolgame.ru/agent-v3/js/smol-core/smol-core.js"');
        } catch (e) {
          console.error("Failed to load seed", e);
        }

        const config = getLLMConfig(usedProvider);
        let progressLogs = "";

        // Wrapper for generateGame that implements fallback
        const generateWithFallback = async (prompt: string, systemPrompt?: string) => {
          const msgs = [
            { role: "system" as const, content: systemPrompt || "You are a helpful AI." },
            { role: "user" as const, content: prompt }
          ];
          const result = await streamWithFallback(msgs, () => {}, signal, usedProvider);
          return result.text;
        };

        const result = await generateGame(gameSpec, {
          generateFn: generateWithFallback,
          goldenSeeds: { "ultimate-runner-seed": seedContent },
          onProgress: (msg) => {
            progressLogs += `> ${msg}\n`;
            updateMessage(assistantId, {
              content: (beforeTag ? beforeTag + "\n\n" : "") + "🤖 **Логи SEP Engine:**\n\`\`\`bash\n" + progressLogs + "\n\`\`\`",
              isStreaming: true
            });
          }
        });

        if (result.isSuccess && result.generatedCode) {
          finalCode = result.generatedCode;
        } else {
          throw new Error(result.errors.join("\n") || "SEP Pipeline failed.");
        }
      }

      if (!finalCode || finalCode.length < 50) {
        throw new Error("Empty code generated.");
      }

      // Cleanup
      finalCode = finalCode.replace(/```[a-z]*\n/gi, '').replace(/```/g, '');

      // Final Analysis
      const analysis = analyzeGameCode(finalCode);
      const qualityNote = analysis.juiceScore < 85
        ? `\n\n⚠️ *Качество:* Сочность ${analysis.juiceScore}% (рекомендуется добавить эффектов).`
        : `\n\n✅ *Качество:* Сочность ${analysis.juiceScore}% - Отлично!`;

      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова!**\n\n🛠 **Код в Студии.** Нажми «Опубликовать», чтобы выпустить игру.${qualityNote}`,
        gameCode: finalCode,
        isStreaming: false,
        deployState: { phase: "ready", status: "Готово", pagesUrl: "" }
      });

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

  return { messages, isRunning, step, sendMessage, stop, reset };
}
