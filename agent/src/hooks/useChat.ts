import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ChatMessage,
  ChatRole,
  ChatSession,
  ModelProgress,
} from "@/types/chat";
import type { APIProvider } from "@/lib/llm-api";
import { generateStream } from "@/lib/llm-api";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { GameFlowOrchestratorV2 } from "../lib/core/gameFlowOrchestratorV2";
import type { GameSpec } from "../lib/core/types";

const STORAGE_KEY = "hybrid-chat-sessions-v2";
const ACTIVE_SESSION_KEY = "hybrid-chat-active-session-v2";
const SETTINGS_KEY = "hybrid-chat-settings";
const USAGE_KEY = "hybrid-chat-usage";

export interface UsageStats {
  requests: number;
  lastReset: number;
}

const DEFAULT_USAGE: UsageStats = {
  requests: 0,
  lastReset: Date.now(),
};

const SYSTEM_PROMPT_CONTENT = `Ты — Старший Геймдизайнер и Архитектор SmolGame. Твоя задача: помочь пользователю создать идеальную гипер-казуальную игру для Telegram через интервью.

1. МЫШЛЕНИЕ: Прежде чем ответить, всегда анализируй контекст внутри скрытого тега <thought>. Оценивай: соответствует ли идея стандартам SmolGame? Какие могут быть ошибки? Как сделать игру лучше?
2. ИНТЕРВЬЮ: Задавай вопросы по одному. Твоя цель — заполнить 7 полей: Жанр, Механика, Визуал, Аудитория, Сюжет, Прогрессия, Фишки.
3. ОБЩЕНИЕ: Будь дружелюбным экспертом. Анализируй ответы пользователя, предлагай свои идеи, корректируй концепцию «на лету», чтобы итоговая игра была хитом.
4. ТЕХНИЧЕСКИЕ ДЕТАЛИ: НИКОГДА не пиши код в обычном тексте. Не обсуждай технические реализации, если тебя не спросят.
5. СКРЫТАЯ ГЕНЕРАЦИЯ: Когда концепция готова, сгенерируй код игры в теге <game_prototype>.
6. СОСТОЯНИЕ: После каждого ответа добавляй скрытый тег <game_spec> с текущим пониманием всех 7 полей в формате JSON.
7. ЯЗЫК: Только русский.

ТВОЙ АЛГОРИТМ:
- Анализ: <thought>Мои размышления...</thought>
- Ответ: Твой текст пользователю...
- Стейт: <game_spec>{"genre": "...", ...}</game_spec>

ВАЖНО: Пользователь не видит <thought>, <game_spec> и <game_prototype>. Он видит только твой живой, экспертный диалог.`;

// Removed unused SYSTEM_PROMPT

interface ChatSettings {
  provider: APIProvider;
  apiKey: string;
  model: string;
}

const DEFAULT_SETTINGS: ChatSettings = {
  provider: "openrouter",
  apiKey: "",
  model: "deepseek/deepseek-chat",
};

function generateId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isChatRole(role: unknown): role is ChatRole {
  return role === "user" || role === "assistant" || role === "system";
}

function normalizeSession(input: unknown): ChatSession | null {
  if (!input || typeof input !== "object") return null;

  const session = input as Partial<ChatSession>;
  if (typeof session.id !== "string" || !Array.isArray(session.messages)) return null;

  const messages = session.messages
    .filter((message): message is ChatMessage => {
      return Boolean(
        message &&
          typeof message.id === "string" &&
          isChatRole(message.role) &&
          typeof message.content === "string" &&
          typeof message.timestamp === "number"
      );
    })
    .map((message) => ({ ...message, isStreaming: false }));

  return {
    id: session.id,
    title: typeof session.title === "string" && session.title.trim() ? session.title : "New Chat",
    messages,
    createdAt: typeof session.createdAt === "number" ? session.createdAt : Date.now(),
    updatedAt: typeof session.updatedAt === "number" ? session.updatedAt : Date.now(),
    modelName: typeof session.modelName === "string" ? session.modelName : "HybridAI 2.0",
  };
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed.map(normalizeSession).filter((session): session is ChatSession => session !== null);
  } catch (error) {
    console.warn("Failed to load chat sessions from localStorage", error);
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function createDefaultSession(): ChatSession {
  const now = Date.now();
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: now,
    updatedAt: now,
    modelName: "HybridAI 2.0",
  };
}

function loadSettings(): ChatSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function loadUsage(): UsageStats {
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return DEFAULT_USAGE;
    const stats = JSON.parse(raw) as UsageStats;
    
    // Reset if more than 24h passed
    if (Date.now() - stats.lastReset > 24 * 60 * 60 * 1000) {
      return DEFAULT_USAGE;
    }
    return stats;
  } catch {
    return DEFAULT_USAGE;
  }
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [usage, setUsage] = useState<UsageStats>(loadUsage);

  // --- CORE SYSTEM INTEGRATION ---
  const orchestratorRef = useRef<GameFlowOrchestratorV2 | null>(null);

  useEffect(() => {
    if (activeSessionId) {
      orchestratorRef.current = new GameFlowOrchestratorV2("user-1", activeSessionId);
    }
  }, [activeSessionId]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [modelProgress] = useState<ModelProgress>({
    progress: 100,
    text: "API Ready",
    status: "ready",
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  // Initialize
  useEffect(() => {
    const loadedSessions = loadSessions();
    const initialSessions = loadedSessions.length > 0 ? loadedSessions : [createDefaultSession()];
    const savedActiveId = localStorage.getItem(ACTIVE_SESSION_KEY) || "";
    const initialActiveId = initialSessions.some((s) => s.id === savedActiveId)
      ? savedActiveId
      : initialSessions[0].id;

    setSessions(initialSessions);
    setActiveSessionId(initialActiveId);
  }, []);

  // Save sessions on change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions);
    }
  }, [sessions]);

  // Save active session ID
  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
    }
  }, [activeSessionId]);

  // Save settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Save usage
  useEffect(() => {
    localStorage.setItem(USAGE_KEY, JSON.stringify(usage));
  }, [usage]);

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession();

  const updateSettings = useCallback((newSettings: Partial<ChatSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const incrementUsage = useCallback(() => {
    setUsage((prev) => ({
      ...prev,
      requests: prev.requests + 1,
      lastReset: prev.lastReset,
    }));
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isGenerating) return;

      if (!settings.apiKey) {
        console.warn("API Key is missing. Prompting user to configure it.");
        const errorMsg: ChatMessage = {
          id: generateId(),
          role: "assistant",
          content: "⚠️ **API-ключ не найден.**\n\nПожалуйста, перейдите в **Настройки** (иконка шестеренки внизу слева) и введите ваш API-ключ (OpenRouter или DeepSeek), чтобы начать создание игр.",
          timestamp: Date.now(),
        };
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSessionId
              ? { ...s, messages: [...s.messages, { id: generateId(), role: "user", content, timestamp: Date.now() }, errorMsg], updatedAt: Date.now() }
              : s
          )
        );
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: "user",
        content,
        timestamp: Date.now(),
      };

      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
        isStreaming: true,
      };

      let targetSessionId = activeSessionId;
      
      setSessions((prev) => {
        let session = prev.find((s) => s.id === activeSessionId);
        if (!session) {
          session = createDefaultSession();
          targetSessionId = session.id;
          setActiveSessionId(session.id);
          const newSessions = [session, ...prev];
          return newSessions.map(s => s.id === targetSessionId ? {
            ...s,
            messages: [...s.messages, userMessage, assistantMessage],
            title: content.slice(0, 40) + (content.length > 40 ? "..." : ""),
            updatedAt: Date.now()
          } : s);
        }

        return prev.map((s) =>
          s.id === targetSessionId
            ? {
                ...s,
                messages: [...s.messages, userMessage, assistantMessage],
                title: s.title === "New Chat" ? content.slice(0, 40) + (content.length > 40 ? "..." : "") : s.title,
                updatedAt: Date.now(),
              }
            : s
        );
      });

      setIsGenerating(true);
      setGenerationStep("Connecting to provider...");
      incrementUsage();
      abortControllerRef.current = new AbortController();

      try {
        const session = sessions.find(s => s.id === targetSessionId) || currentSession;
        const apiMessages = [
          { role: "system" as const, content: SYSTEM_PROMPT_CONTENT },
          ...session.messages.map(m => ({ role: m.role, content: m.content })),
          { role: "user" as const, content }
        ];

        const stream = generateStream(
          apiMessages,
          {
            provider: settings.provider,
            apiKey: settings.apiKey,
            model: settings.model,
          },
          abortControllerRef.current.signal
        );

        let fullContent = "";
        setGenerationStep("Streaming response...");
        for await (const chunk of stream) {
          fullContent += chunk;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m, idx) =>
                      idx === s.messages.length - 1 ? { ...m, content: fullContent } : m
                    ),
                  }
                : s
            )
          );
        }

        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m, idx) =>
                    idx === s.messages.length - 1 ? { ...m, isStreaming: false } : m
                  ),
                }
              : s
          )
        );
        
        // --- CORE SYSTEM STATE SYNC ---
        if (fullContent.includes('<game_spec>')) {
          const specMatch = fullContent.match(/<game_spec>\s*([\s\S]*?)(?:<\/game_spec>|$)/);
          if (specMatch && orchestratorRef.current) {
            try {
              const spec = JSON.parse(specMatch[1].trim());
              Object.entries(spec).forEach(([key, value]) => {
                if (value && typeof value === 'string') {
                  orchestratorRef.current?.updateInterviewAnswer(key as keyof GameSpec, value);
                }
              });
            } catch (e) {
              console.error("Failed to parse <game_spec>", e);
            }
          }
        }

        // --- PRODUCTION QUALITY PIPELINE INTEGRATION ---
        if (fullContent.includes('<game_prototype>')) {
          const gameId = targetSessionId;
          const htmlCodeMatch = fullContent.match(/<game_prototype>\s*([\s\S]*?)(?:<\/game_prototype>|$)/);
          const htmlCode = htmlCodeMatch ? htmlCodeMatch[1].trim() : fullContent;

          try {
            setIsPipelineRunning(true);
            setGenerationStep("Quality assurance in progress...");
            const result = await runGamePipeline(gameId, htmlCode, {
              onProgress: (msg) => {
                setSessions((prev) =>
                  prev.map((s) =>
                    s.id === targetSessionId
                      ? {
                          ...s,
                          messages: s.messages.map((m, idx) =>
                            idx === s.messages.length - 1 ? { ...m, status: msg } : m
                          ),
                        }
                      : s
                  )
                );
              }
            });

            setSessions((prev) =>
              prev.map((s) =>
                s.id === targetSessionId
                  ? {
                      ...s,
                      messages: s.messages.map((m, idx) =>
                        idx === s.messages.length - 1 ? { ...m, pipelineResult: result, status: "Quality Check Complete" } : m
                      ),
                    }
                  : s
              )
            );
          } catch (pipelineError) {
            console.error("Pipeline failed:", pipelineError);
          } finally {
            setIsPipelineRunning(false);
            setGenerationStep("");
          }
        }
        // ----------------------------------------------

      } catch (error: any) {
        if (error.name === 'AbortError') {
          // Preserve what we have
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m, idx) =>
                      idx === s.messages.length - 1 ? { ...m, isStreaming: false } : m
                    ),
                  }
                : s
            )
          );
        } else {
          console.error("Failed to generate response:", error);
          setSessions((prev) =>
            prev.map((s) =>
              s.id === targetSessionId
                ? {
                    ...s,
                    messages: s.messages.map((m, idx) =>
                      idx === s.messages.length - 1
                        ? { ...m, content: `${m.content}\n\n[Error: ${error.message || "Unknown error"}]`, isStreaming: false }
                        : m
                    ),
                  }
                : s
            )
          );
        }
      } finally {
        setIsGenerating(false);
        setGenerationStep("");
        abortControllerRef.current = null;
      }
    },
    [activeSessionId, sessions, currentSession, settings, isGenerating]
  );

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  const createNewChat = useCallback(() => {
    const session = createDefaultSession();
    setSessions((prev) => [session, ...prev]);
    setActiveSessionId(session.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback((id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) return [createDefaultSession()];
      return filtered;
    });
    setActiveSessionId((prev) => (prev === id ? "" : prev));
  }, []);

  const clearAllSessions = useCallback(() => {
    const session = createDefaultSession();
    setSessions([session]);
    setActiveSessionId(session.id);
  }, []);

  const factoryReset = useCallback(() => {
    // Don't use confirm() — it's blocked in Telegram WebView
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(USAGE_KEY);
    window.location.reload();
  }, []);

  const retryLastMessage = useCallback(() => {
    const session = sessions.find((s) => s.id === activeSessionId);
    if (!session || isGenerating) return;

    const lastUserMessage = [...session.messages].reverse().find((m) => m.role === "user");
    if (!lastUserMessage) return;

    // Remove last assistant message if it exists
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? {
              ...s,
              messages: s.messages.filter((m, idx) => idx !== s.messages.length - 1 || m.role !== "assistant"),
            }
          : s
      )
    );

    sendMessage(lastUserMessage.content);
  }, [activeSessionId, sessions, isGenerating, sendMessage]);

  return {
    sessions,
    activeSessionId,
    currentSession,
    modelProgress,
    isGenerating: isGenerating || isPipelineRunning,
    isPipelineRunning,
    settings,
    updateSettings,
    sendMessage,
    stopGeneration,
    createNewChat,
    switchSession,
    deleteSession,
    clearAllSessions,
    factoryReset,
    retryLastMessage,
    usage,
    generationStep,
    setGenerationStep,
    initModel: () => {}, // No-op in 2.0
  };
}

