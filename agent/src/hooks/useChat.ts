import { useState, useRef, useEffect, useCallback } from "react";
import type { 
  ChatSession, 
  ChatMessage, 
  ChatSettings, 
  UsageStats, 
  ModelProgress,
  APIProvider
} from "../types/chat";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { GameFlowOrchestratorV2 } from "../lib/core/gameFlowOrchestratorV2";
import type { GameSpec } from "../lib/core/types";
import { generateStream, pool } from "../lib/llm-api";
import { SmolGameAPI } from "../lib/smolgame-api";
import type { PipelineResult } from "../lib/core/gameGenerationPipelinePro";

const SESSIONS_KEY = "smol_chat_sessions_v3";
const ACTIVE_SESSION_KEY = "smol_active_session_id_v3";
const SETTINGS_KEY = "smol_chat_settings_v3";
const USAGE_KEY = "smol_chat_usage_v3";

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "together", "sambanova", "glhf", "deepseek", "openrouter", "huggingface", "custom"];

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function loadSessions(): ChatSession[] {
  const saved = localStorage.getItem(SESSIONS_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function loadSettings(): ChatSettings {
  const saved = localStorage.getItem(SETTINGS_KEY);
  if (!saved) return { 
    primaryProvider: "openrouter", 
    keys: {}, 
    models: {},
    autoFailover: true,
    maxRetries: 3
  };
  try {
    return JSON.parse(saved);
  } catch {
    return { 
      primaryProvider: "openrouter", 
      keys: {}, 
      models: {},
      autoFailover: true,
      maxRetries: 3
    };
  }
}

function loadUsage(): UsageStats {
  const saved = localStorage.getItem(USAGE_KEY);
  if (!saved) return { requests: {}, lastReset: Date.now() };
  try {
    return JSON.parse(saved);
  } catch {
    return { requests: {}, lastReset: Date.now() };
  }
}

function createDefaultSession(): ChatSession {
  return {
    id: generateId(),
    title: "New Chat",
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    modelName: "auto"
  };
}

export function useChat() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const [usage, setUsage] = useState<UsageStats>(loadUsage);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPipelineRunning, setIsPipelineRunning] = useState(false);
  const [generationStep, setGenerationStep] = useState("");
  const [isAutoDeploying, setIsAutoDeploying] = useState(false);
  const [modelProgress] = useState<ModelProgress>({
    progress: 100,
    text: "Orchestrator Ready",
    status: "ready",
  });

  const orchestratorRef = useRef<GameFlowOrchestratorV2 | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastFailedPipelineRef = useRef<PipelineResult | null>(null);

  useEffect(() => {
    const loaded = loadSessions();
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (loaded.length > 0) {
      setSessions(loaded);
      if (activeId && loaded.find(s => s.id === activeId)) {
        setActiveSessionId(activeId);
      } else {
        setActiveSessionId(loaded[0].id);
      }
    } else {
      const def = createDefaultSession();
      setSessions([def]);
      setActiveSessionId(def.id);
    }
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
      try {
        orchestratorRef.current = new GameFlowOrchestratorV2("user-1", activeSessionId);
      } catch (e) {
        console.error("Failed to init orchestrator", e);
      }
    }
  }, [activeSessionId]);

  useEffect(() => { saveSessions(sessions); }, [sessions]);
  useEffect(() => { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }, [settings]);
  useEffect(() => { localStorage.setItem(USAGE_KEY, JSON.stringify(usage)); }, [usage]);

  const sessionsRef = useRef(sessions);
  useEffect(() => { sessionsRef.current = sessions; }, [sessions]);

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: "default",
    title: "New Project",
    messages: [],
    updatedAt: Date.now()
  };

  const sendMessage = useCallback(async (content: string, isHidden: boolean = false) => {
    if (isGenerating && !isHidden) return;

    const userMsg: ChatMessage = { id: generateId(), role: "user", content, timestamp: Date.now(), isHidden };
    const assistantMsg: ChatMessage = { id: generateId(), role: "assistant", content: "", timestamp: Date.now(), isStreaming: true };

    let sessionId = activeSessionId;
    if (!sessionId || !sessionsRef.current.find(s => s.id === sessionId)) {
      const newId = generateId();
      const newSession: ChatSession = {
        id: newId,
        title: content.slice(0, 30),
        messages: [userMsg, assistantMsg],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newId);
      sessionId = newId;
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: [...s.messages, userMsg, assistantMsg],
        updatedAt: Date.now(),
        title: s.title === "New Chat" ? content.slice(0, 30) : s.title
      } : s));
    }

    const historyBefore = sessionsRef.current.find(s => s.id === sessionId)?.messages || [];
    const messageHistory = [...historyBefore, userMsg];

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60000);
    const currentSettings = settings;

    try {
      if (!orchestratorRef.current) {
        try {
          orchestratorRef.current = new GameFlowOrchestratorV2("user-1", sessionId);
        } catch (e) {
          orchestratorRef.current = new GameFlowOrchestratorV2("user-1", undefined);
        }
      }
      const orchestrator = orchestratorRef.current;

      let success = false;
      let lastError = "";
      
      const providersToTry = currentSettings.autoFailover 
        ? [currentSettings.primaryProvider, ...FALLBACK_ORDER.filter(p => p !== currentSettings.primaryProvider)]
        : [currentSettings.primaryProvider];
      
      const hasAnyKey = Object.values(currentSettings.keys).some(k => !!k);
      if (!hasAnyKey) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s,
          messages: [...s.messages, {
            id: generateId(),
            role: "assistant",
            content: "❌ **Ошибка: Ключи API не найдены.**",
            timestamp: Date.now()
          }]
        } : s));
        setIsGenerating(false);
        return;
      }

    for (const provider of providersToTry) {
      if (success) break;
      const apiKey = currentSettings.keys[provider];
      if (!apiKey) continue;

      try {
        const currentAnswers = orchestrator.getSession().answers || {};
        const isComplete = orchestrator.isInterviewComplete();
        const requiredFields = ['genre', 'mechanics', 'visuals', 'audience', 'story', 'progression', 'special_features'];
        const missingFields = requiredFields.filter(f => !(currentAnswers as any)[f]);
        const nextField = missingFields[0];

        const FIELD_NAMES: Record<string, string> = {
          genre: "Жанр", mechanics: "Механика", visuals: "Визуал", audience: "Аудитория", story: "Сюжет", progression: "Прогрессия", special_features: "Фишки"
        };

        const SMART_SYSTEM_PROMPT = `Ты — Элитный Геймдизайнер и Frontend-разработчик SmolGame. Твоя цель — создать хитовую веб-игру.

ПРАВИЛА ОБЩЕНИЯ:
1. Если интервью в процессе, задавай ОДИН четкий вопрос.
2. ЕСЛИ ПОЛЬЗОВАТЕЛЬ ГОВОРИТ "делай игру", "хватит вопросов", "сделай сам" или проявляет нетерпение — НЕ СПРАШИВАЙ БОЛЬШЕ НИЧЕГО.
3. В этом случае САМ додумай все недостающие детали, обнови спецификацию через <game_spec> и СРАЗУ выдай готовый код игры в тегах <game_prototype>.
4. НЕ ИГРАЙ в игру текстом! Пиши КОД игры (HTML/JS/CSS).

${isComplete ? `ИНТЕРВЬЮ ЗАВЕРШЕНО. Спецификация: ${JSON.stringify(currentAnswers)}. ЗАДАЧА: Выдай <game_prototype>.` : `ИНТЕРВЬЮ В ПРОЦЕССЕ. Твоя задача: либо вопрос про ${FIELD_NAMES[nextField || '']}, либо <game_prototype>, если просят начать.`}

ОБЯЗАТЕЛЬНО:
- Код в ОДНОМ файле внутри <game_prototype>.
- Ответ на РУССКОМ. Используй Markdown.
- Обновляй спецификацию через <game_spec>...</game_spec> (JSON).`;

        const messagesForAI = [
          { role: "system" as const, content: SMART_SYSTEM_PROMPT },
          ...messageHistory.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
          { role: "user" as const, content }
        ];

        const stream = generateStream(messagesForAI, {
          provider,
          apiKey,
          model: currentSettings.models[provider] || "",
          baseUrl: currentSettings.customBaseUrl
        }, controller.signal);

        let fullContent = "";
        setGenerationStep(isComplete ? "Подготовка к сборке..." : "Анализирую...");

        for await (const chunk of stream) {
          if (controller.signal.aborted) break;
          fullContent += chunk;
          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent } : m)
          } : s));
        }

        if (!fullContent.trim()) throw new Error("Пустой ответ.");
        setUsage(prev => ({ ...prev, requests: { ...prev.requests, [provider]: (prev.requests[provider] || 0) + 1 } }));
        success = true;

        if (fullContent.includes("<game_spec>")) {
          const specMatch = fullContent.match(/<game_spec>([\s\S]*?)<\/game_spec>/);
          if (specMatch) {
            try {
              const spec = JSON.parse(specMatch[1]);
              Object.entries(spec).forEach(([k, v]) => { orchestrator.updateInterviewAnswer(k as keyof GameSpec, String(v)); });
            } catch {}
          }
        }

        if (fullContent.includes("<game_prototype>")) {
          const codeMatch = fullContent.match(/<game_prototype>([\s\S]*?)<\/game_prototype>/);
          if (codeMatch) {
            setIsPipelineRunning(true);
            setGenerationStep(`Проверка качества...`);
            const result = await runGamePipeline(sessionId, codeMatch[1]);
            setSessions(prev => prev.map(s => s.id === sessionId ? {
              ...s,
              messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, pipelineResult: result } : m)
            } : s));
            setIsPipelineRunning(false);
            setGenerationStep("");
            if (result.finalScore >= 70) lastFailedPipelineRef.current = null; else lastFailedPipelineRef.current = result;
            if (result.isPublishable) {
              const gameTitle = codeMatch[1].match(/<title>([^<]{1,60})<\/title>/i)?.[1]?.trim() || "Smol Game";
              if ((window as any).__smolAuthUser?.isGithubConnected) {
                setIsAutoDeploying(true);
                try {
                  const deployResult = await SmolGameAPI.publishGame({ gameTitle, files: [{ path: "index.html", content: result.generatedCode }], gameDescription: "AI Generated" });
                  if (deployResult.ok) {
                    setSessions(prev => prev.map(s => s.id === sessionId ? {
                      ...s,
                      messages: s.messages.map(m => m.id === assistantMsg.id ? {
                        ...m,
                        pipelineResult: { ...result, autoDeployed: true },
                        deployResult: { pagesUrl: deployResult.pagesUrl, repoUrl: `https://github.com/${deployResult.repo}`, pagesReady: deployResult.pagesReady }
                      } : m)
                    } : s));
                  }
                } catch {} finally { setIsAutoDeploying(false); }
              } else { SmolGameAPI.savePendingGame({ htmlCode: result.generatedCode, title: gameTitle }); }
            }
          }
        }
      } catch (e: any) {
        lastError = `[${provider}] ${e.message}`;
      }
    }

    if (!success) {
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === assistantMsg.id ? { 
          ...m, content: `❌ Не удалось получить ответ. Последняя ошибка: ${lastError}`, isStreaming: false 
        } : m)
      } : s));
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m) } : s));
    }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
      abortControllerRef.current = null;
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m) } : s));
    }
  }, [activeSessionId, sessions, settings, isGenerating]);

  return {
    sessions, activeSessionId, currentSession, modelProgress, isGenerating, isPipelineRunning, isAutoDeploying, settings, generationStep, usage,
    sendMessage, deployToGitHub: () => sendMessage("Пользователь отправил игру на модерацию.", true),
    stopGeneration: () => { if (abortControllerRef.current) { abortControllerRef.current.abort(); setIsGenerating(false); } },
    updateSettings: (s: Partial<ChatSettings>) => setSettings(prev => ({ ...prev, ...s })),
    createNewChat: () => { const s = createDefaultSession(); setSessions([s, ...sessions]); setActiveSessionId(s.id); },
    switchSession: (id: string) => setActiveSessionId(id),
    deleteSession: (id: string) => {
      const filtered = sessions.filter(s => s.id !== id);
      setSessions(filtered.length ? filtered : [createDefaultSession()]);
      if (id === activeSessionId) setActiveSessionId(filtered[0]?.id || "");
    },
    clearAllSessions: () => { const s = createDefaultSession(); setSessions([s]); setActiveSessionId(s.id); },
    factoryReset: () => { localStorage.clear(); window.location.reload(); },
    retryLastMessage: () => {}
  };
}
