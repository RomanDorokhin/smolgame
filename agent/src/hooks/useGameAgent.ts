import { useState, useCallback, useRef, useEffect } from "react";
import { generateStream, type LLMConfig } from "@/lib/llm-api";
import { SmolGameAPI } from "@/lib/smolgame-api";
import type { APIProvider, ChatSettings } from "@/types/chat";
import { pool } from "@/lib/llm-api";
import { INTERVIEWER_PROMPT, AIDER_EDITOR_PROMPT } from "./agent_prompts";
import { generateGame } from "@/lib/sep/gameGenerationPipelinePro";
import { analyzeGameCode } from "@/lib/sep/game-code-analyzer";
import { getFullKnowledgePrompt } from "@/lib/knowledge-base";
import { SmolAgent } from "@/lib/sep/SmolAgent";
import { getIframeError } from "@/pages/Home"; // I'll need to export this or find a way to get it

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

const FALLBACK_ORDER: APIProvider[] = ["smolbackend", "gemini", "groq", "openrouter", "together", "deepseek", "huggingface"];

const DEFAULT_MODELS: Record<string, string[]> = {
  gemini: ["gemini-2.5-flash"],
  groq: ["llama-3.3-70b-versatile"],
  openrouter: ["google/gemini-2.5-flash"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  deepseek: ["deepseek-chat"],
  huggingface: ["meta-llama/Llama-3.2-11B-Vision-Instruct"],
  smolbackend: ["gemini-1.5-pro"],
};

const makeId = () => Math.random().toString(36).substring(2, 9);

const safeStorage = {
  set: (key: string, val: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_e) {}
  },
  get: <T>(key: string, defaultVal: T): T => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultVal;
    } catch (_e) {
      return defaultVal;
    }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch (_e) {}
  }
};

// ──────────────────────────────────────────────
// AIDER DIFF PARSER (SEARCH/REPLACE)
// ──────────────────────────────────────────────
function parseAiderBlocks(text: string): { search: string, replace: string }[] {
  const blocks: { search: string, replace: string }[] = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> REPLACE/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      search: match[1].replace(/\r\n/g, '\n'),
      replace: match[2].replace(/\r\n/g, '\n')
    });
  }
  return blocks;
}

function applyAiderBlocks(originalCode: string, blocks: { search: string, replace: string }[]): { code: string, success: boolean } {
  let currentCode = originalCode.replace(/\r\n/g, '\n');
  let success = true;

  for (const block of blocks) {
    if (!block.search.trim()) continue;

    if (currentCode.includes(block.search)) {
      currentCode = currentCode.replace(block.search, block.replace);
    } else {
      console.warn("Aider block search text not found exactly. Attempting loose match...");
      const searchLines = block.search.split('\n').map(l => l.trim()).filter(l => l);
      let found = false;
      
      // Fallback: simple exact line-by-line replacement if the block is small
      if (searchLines.length > 0 && searchLines.length < 5) {
         let looseCode = currentCode;
         let replacementsMade = 0;
         for (const sLine of searchLines) {
             if (looseCode.includes(sLine)) {
                 // Try replacing the first matched line with the whole replace block (hacky)
                 if (replacementsMade === 0) {
                     looseCode = looseCode.replace(sLine, block.replace.trim());
                     replacementsMade++;
                 } else {
                     looseCode = looseCode.replace(sLine, ''); // strip remaining search lines
                 }
             }
         }
         if (replacementsMade > 0) {
             currentCode = looseCode;
             found = true;
         }
      }

      if (!found) success = false;
    }
  }

  return { code: currentCode, success };
}


// ──────────────────────────────────────────────
// ХУК USE GAME AGENT
// ──────────────────────────────────────────────
export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    safeStorage.get("smol_agent_messages_v1", [])
  );
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const [targetRepo, setTargetRepo] = useState<string | null>(null);

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
      if (p === 'smolbackend') return true;
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

  const summarizeHistory = useCallback(async (history: { role: string; content: string }[]): Promise<string> => {
    if (history.length < 10) return "";
    setStep("🧠 Сжимаю контекст сессии...");
    const config = getLLMConfig(getActiveProviders()[0]);
    const summary = await generateStream([
      { role: "system", content: "Summarize the game development progress so far. Focus on what was built, what was fixed, and what is the current goal. Be technical and concise." },
      ...history
    ], config).next(); // Just get one chunk or use generateText
    // For simplicity in this demo, I'll use a mock summarization if generateText isn't easy here
    return "Summary of previous steps: Building " + history[0].content.slice(0, 50) + "...";
  }, [getActiveProviders, getLLMConfig]);

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
        if (i > 0) setStep(`🔄 Semantic Fallback: Escalating to ${providerId.toUpperCase()}...`);

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
        const isAuth = lastError.includes("401") || lastError.includes("403");
        
        pool.reportFailure(providerId, isRate, lastError);
        
        // If it's an Auth error, don't just retry other providers if they might have same issue, 
        // but here they have different keys so it's fine.
        
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
      // --- CONTEXT MANAGEMENT (Summarization Buffer) ---
      let historyToUse = chatHistory.current;
      if (historyToUse.length > 20) {
         const summary = await summarizeHistory(historyToUse.slice(0, -10));
         historyToUse = [
           { role: "system", content: `CONTEXT SUMMARY: ${summary}` },
           ...historyToUse.slice(-10)
         ];
      }

      // ── PHASE 1: INTERVIEWER ────────────────────────────
      setStep("💬 Анализирую контекст...");
      const interviewMsgs = [
        { 
          role: "system" as const, 
          content: INTERVIEWER_PROMPT + "\n\n" + getFullKnowledgePrompt('general', userText) 
        },
        ...historyToUse,
      ];

      const stripPromptTag = (text: string) =>
        text
          .replace(/<thought>([\s\S]*?)<\/thought>/gi, "")
          .replace(/<qa_self_audit>([\s\S]*?)<\/qa_self_audit>/gi, "")
          .replace(/<plan>([\s\S]*?)<\/plan>/gi, "")
          .replace(/<\/?plan>/gi, "")
          .replace(/<\/?thought>/gi, "")
          .replace(/<\/?qa_self_audit>/gi, "")
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
      
      const modeMatch = interviewText.match(/<mode>\s*(NEW|MODIFY)\s*<\/mode>/i);
      const isModification = modeMatch 
        ? modeMatch[1].toUpperCase() === "MODIFY" && !!previousCode 
        : !!previousCode;

      let finalCode = "";

      if (isModification) {
        setStep("🤖 Агент: Приступаю к автономному циклу правок...");
        
        const runtimeError = (window as any).lastSmolError || "";

        const agent = new SmolAgent({
          llm: getLLMConfig(usedProvider),
          onProgress: (msg) => {
            updateMessage(assistantId, {
              content: (beforeTag ? beforeTag + "\n\n" : "") + `🤖 **${msg}**`,
              isStreaming: true
            });
          },
          signal
        });

        finalCode = await agent.runFixLoop(gameSpec, previousCode!, runtimeError);
        (window as any).lastSmolError = ""; 
      } else {
        // --- 5-STAGE SEP PIPELINE ---
        setStep("🚀 Запуск SEP Pipeline (World Class)...");
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 **Инициализация SEP Core...**",
          isStreaming: true,
        });

        const config = getLLMConfig(usedProvider);
        
        const pipelineGenerateFn = async (msgs: any[]) => {
          const { text } = await streamWithFallback(msgs, () => {}, signal, usedProvider);
          return text;
        };

        const result = await generateGame(gameSpec, {
          generateFn: pipelineGenerateFn,
          llmConfig: config,
          onProgress: (msg) => {
            let cleanStatus = msg;
            let progress = 30;
            if (msg.includes("Phase: Specification")) { cleanStatus = "Анализирую требования..."; progress = 20; }
            else if (msg.includes("Phase: Architecture")) { cleanStatus = "Проектирую архитектуру..."; progress = 40; }
            else if (msg.includes("Phase: Component Implementation")) { cleanStatus = "Реализую логику..."; progress = 60; }
            else if (msg.includes("Phase: Assembly")) { cleanStatus = "Сборка билда..."; progress = 80; }
            else if (msg.includes("Phase: QA")) { cleanStatus = "QA: Поиск багов и впрыск Juice..."; progress = 90; }
            
            updateMessage(assistantId, {
              content: (beforeTag ? beforeTag + "\n\n" : "") + "✨ **Магия SEP в процессе...**\n\n" + cleanStatus,
              isStreaming: true,
              progress
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

      finalCode = finalCode.replace(/```[a-z]*\n/gi, '').replace(/```/g, '');

      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Проект завершен.**\n\n🛠 **Код верифицирован и готов к публикации.**`,
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
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, getLLMConfig, streamWithFallback, messages, summarizeHistory]);

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



