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

const SYSTEM_PROMPT_CONTENT = "Ты — Старший Геймдизайнер SmolGame. Твоя задача: собрать инфо для создания игры через ИНТЕРВЬЮ.\n\n" +
"1. КРАТКОСТЬ: Отвечай максимально лаконично. Минимум текста, никакой воды.\n" +
"2. ИНТЕРВЬЮ: СТРОГО обязательно выяснить 7 параметров: Жанр, Механика, Визуал, Аудитория, Сюжет, Прогрессия, Фишки. Задавай 1-2 коротких уточняющих вопроса за раз.\n" +
"3. ЗАПРЕТ НА КОД: Код ТОЛЬКО в <game_prototype>. В чате код ПИСАТЬ ЗАПРЕЩЕНО.\n" +
"4. ГЕНЕРАЦИЯ: ТОЛЬКО ПОСЛЕ того, как все 7 параметров будут ясны, выдавай <game_prototype>.\n" +
"5. ЯЗЫК: Русский.";

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "deepseek", "mistral", "openrouter", "custom"];

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
  /** Last failed pipeline result — used for Self-Correction Loop */
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

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: "default",
    title: "New Project",
    messages: [],
    updatedAt: Date.now()
  };

  const sendMessage = useCallback(async (content: string, isHidden: boolean = false) => {
    if (isGenerating && !isHidden) return;

    const sessionId = activeSessionId;
    const freshSession = sessions.find(s => s.id === sessionId);
    const messageHistory = freshSession ? [...freshSession.messages] : [];

    const userMsg: ChatMessage = { id: generateId(), role: "user", content, timestamp: Date.now(), isHidden };
    const assistantMsg: ChatMessage = { id: generateId(), role: "assistant", content: "", timestamp: Date.now(), isStreaming: true };

    setSessions(prev => prev.map(s => s.id === sessionId ? {
      ...s,
      messages: [...s.messages, userMsg, assistantMsg],
      updatedAt: Date.now(),
      title: s.title === "New Chat" ? content.slice(0, 30) : s.title
    } : s));

    setIsGenerating(true);
    abortControllerRef.current = new AbortController();

    // Ensure orchestrator exists
    if (!orchestratorRef.current) {
        orchestratorRef.current = new GameFlowOrchestratorV2("user-1", sessionId);
    }
    const orchestrator = orchestratorRef.current;

    let success = false;
    let lastError = "";
    
    const providersToTry = settings.autoFailover 
      ? [settings.primaryProvider, ...FALLBACK_ORDER.filter(p => p !== settings.primaryProvider)]
      : [settings.primaryProvider];

    for (const provider of providersToTry) {
      if (success) break;
      
      const apiKey = settings.keys[provider];
      if (!apiKey) continue;

      const status = pool.getStatus(provider);
      if (status.state === "OPEN") continue;

      try {
        console.log(`[Orchestrator] Attempting with ${provider}...`);
        
        // Dynamically build the smart prompt based on the current interview state
        const currentAnswers = orchestrator.getSession().answers || {};
        const isComplete = orchestrator.isInterviewComplete();
        const progress = orchestrator.getInterviewProgress();
        
        const requiredFields = ['genre', 'mechanics', 'visuals', 'audience', 'story', 'progression', 'special_features'];
        const missingFields = requiredFields.filter(f => !(currentAnswers as any)[f]);
        const nextField = missingFields[0];

        const FIELD_NAMES: Record<string, string> = {
          genre: "Жанр (аркада, платформер, головоломка и т.д.)",
          mechanics: "Главная механика (как именно управлять и что делать)",
          visuals: "Визуальный стиль (цветовая гамма, атмосфера)",
          audience: "Целевая аудитория (для кого игра)",
          story: "Сюжет или смысл (метафора игры)",
          progression: "Прогрессия (что открывается или улучшается)",
          special_features: "Уникальные фишки (что делает игру особенной)"
        };
        const nextFieldRu = nextField ? FIELD_NAMES[nextField] : "";

        // ── Build Self-Correction suffix if previous pipeline failed ─────────────────────────────
        let selfCorrectionContext = "";
        if (lastFailedPipelineRef.current && isComplete) {
          const pr = lastFailedPipelineRef.current;
          const failedGates = (pr.qualityGateResult?.hardGates || [])
            .filter(g => g.status === 'fail')
            .map(g => `- ${g.name}: ${g.message}`);
          const critErrors = (pr.validationReport?.criticalFailures || [])
            .map(f => `- ${f.requirement}: ${f.message}`);
          if (failedGates.length || critErrors.length) {
            selfCorrectionContext = `

⚠️ САМОКОРРЕКЦИЯ: Предыдущая версия игры не прошла валидацию (оценка: ${pr.finalScore}/100).
Критические ошибки, которые НЕОБХОДИМО исправить в новой версии:
${[...failedGates, ...critErrors].join('\n')}

Генерируй полностью новый код, устраняя все вышеуказанные проблемы.`;
          }
        }
        // ────────────────────────────────────────────────────────────────────────────────

        const SMART_SYSTEM_PROMPT = `Ты — Элитный Геймдизайнер и Frontend-разработчик SmolGame.
Твоя цель — помочь пользователю создать хитовую веб-игру (мини-игру). Игры для SmolGame должны работать в браузере (Touch управление, только Portrait ориентация).

${isComplete ? `
ИНТЕРВЬЮ ЗАВЕРШЕНО (7/7 собрано).
Спецификация игры:
${JSON.stringify(currentAnswers, null, 2)}

ТВОЯ ЗАДАЧА:
Напиши полный рабочий код игры внутри тегов <game_prototype>...</game_prototype>.
ВАЖНО: Код должен быть СТРОГО в формате HTML + встроенный JS + CSS (один файл, начинающийся с <!DOCTYPE html>).
КРИТИЧЕСКОЕ ПРАВИЛО: НИКАКОГО PYTHON, PYGAME ИЛИ C++! Только чистый веб! Игра должна открываться и работать в мобильном браузере.
` : `
Мы находимся на этапе сбора идей (Собрано ${progress.filled}/7 параметров).
Уже собрано:
${JSON.stringify(currentAnswers, null, 2)}

Твоя задача на сейчас — узнать у пользователя ТОЛЬКО ОДИН недостающий параметр: "${nextFieldRu}".

КРИТИЧЕСКИЕ ПРАВИЛА ИНТЕРВЬЮ:
1. Задай РОВНО ОДИН короткий вопрос про параметр "${nextFieldRu}".
2. КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ выводить список всех параметров! Спрашивай только про тот, что указан выше.
3. Если пользователь только что ответил на твой предыдущий вопрос, выдели суть его ответа в формате JSON внутри тега <game_spec>.
Пример: <game_spec>{"${nextField}": "выжимка ответа пользователя"}</game_spec>
`}${selfCorrectionContext}
`;

        const messagesForAI = [
          { role: "system" as const, content: SMART_SYSTEM_PROMPT },
          ...messageHistory.map(m => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
          { role: "user" as const, content }
        ];

        const stream = generateStream(messagesForAI, {
          provider,
          apiKey,
          model: settings.models[provider] || "",
          baseUrl: settings.customBaseUrl
        }, abortControllerRef.current.signal);

        let fullContent = "";
        
        if (isComplete) {
          setGenerationStep("Подготовка к сборке...");
        } else {
          setGenerationStep("Анализирую ответ...");
        }

        for await (const chunk of stream) {
          fullContent += chunk;
          
          // STRICT RUNTIME INTERCEPTOR: Prevent rogue code generation during interview
          if (!isComplete && fullContent.includes("<game_prototype>")) {
            fullContent = fullContent.replace(/<game_prototype>[\s\S]*?(?:<\/game_prototype>|$)/g, "\n[СИСТЕМА: Попытка сгенерировать код заблокирована. Сначала нужно завершить интервью.]\n");
          }

          // Dynamic status updates based on what the LLM is currently outputting
          if (fullContent.includes("<thought>") && !fullContent.includes("</thought>")) {
            setGenerationStep("Анализирую недостающие параметры...");
          } else if (fullContent.includes("<game_prototype>") && !fullContent.includes("</game_prototype>")) {
            setGenerationStep("Пишу код (HTML, JS, CSS)...");
          } else if (fullContent.includes("</thought>")) {
            setGenerationStep(isComplete ? "Формирую структуру..." : "Формулирую вопрос...");
          }

          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s,
            messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, content: fullContent } : m)
          } : s));
        }

        setUsage(prev => ({
          ...prev,
          requests: { ...prev.requests, [provider]: (prev.requests[provider] || 0) + 1 }
        }));

        success = true;

        if (fullContent.includes("<game_spec>")) {
          const specMatch = fullContent.match(/<game_spec>([\s\S]*?)<\/game_spec>/);
          if (specMatch) {
            try {
              const spec = JSON.parse(specMatch[1]);
              Object.entries(spec).forEach(([k, v]) => {
                orchestrator.updateInterviewAnswer(k as keyof GameSpec, String(v));
              });
            } catch {}
          }
        }

        if (fullContent.includes("<game_prototype>")) {
          const codeMatch = fullContent.match(/<game_prototype>([\s\S]*?)<\/game_prototype>/);
          if (codeMatch) {
            setIsPipelineRunning(true);
            setGenerationStep(`Проверка качества (via ${provider})...`);
            
            const result = await runGamePipeline(sessionId, codeMatch[1]);
            
            setSessions(prev => prev.map(s => s.id === sessionId ? {
              ...s,
              messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, pipelineResult: result, status: "Готово" } : m)
            } : s));
            
            setIsPipelineRunning(false);
            setGenerationStep("");

            // ── Store result for Self-Correction Loop ──────────────────────────
            if (result.isPublishable) {
              lastFailedPipelineRef.current = null; // Success — clear previous errors
            } else {
              lastFailedPipelineRef.current = result; // Store for next attempt
            }
            // ──────────────────────────────────────────────────────────

            // ── Авто-деплой после успешного пайплайна ─────────────────
            if (result.isPublishable) {
              const gameTitle = codeMatch[1].match(/<title>([^<]{1,60})<\/title>/i)?.[1]?.trim()
                || "Smol Game";
              const isGithubConnected = (window as any).__smolAuthUser?.isGithubConnected;
              
              if (isGithubConnected) {
                // Пользователь уже авторизован — деплоим сразу
                setIsAutoDeploying(true);
                setGenerationStep("Автоматическая публикация в GitHub...");
                try {
                  const deployResult = await SmolGameAPI.publishGame({
                    gameTitle,
                    files: [{ path: "index.html", content: result.generatedCode }],
                    gameDescription: "Generated by SmolGame AI Architect"
                  });
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
                } catch (deployErr: any) {
                  console.warn("[Auto-deploy] failed:", deployErr.message);
                } finally {
                  setIsAutoDeploying(false);
                  setGenerationStep("");
                }
              } else {
                // Не авторизован — сохраняем игру в localStorage, чтобы подобрать после OAuth
                SmolGameAPI.savePendingGame({ htmlCode: result.generatedCode, title: gameTitle });
              }
            }
            // ─────────────────────────────────────────────────────────────
          }
        }


      } catch (e: any) {
        if (e.name === 'AbortError') throw e;
        console.error(`[Orchestrator] ${provider} failed:`, e.message);
        lastError = e.message;
      }
    }

    if (!success) {
      // Build a helpful error message showing all provider statuses
      const allProviders = [...new Set([settings.primaryProvider, ...FALLBACK_ORDER])];
      const configuredProviders = allProviders.filter(p => settings.keys[p]);
      const statusSummary = configuredProviders.length > 0
        ? pool.getSummary(configuredProviders)
        : 'Нет настроенных провайдеров. Добавь API ключи в настройках.';

      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === assistantMsg.id ? { 
          ...m, 
          content: `❌ Все провайдеры недоступны.\n\n**Статус провайдеров:**\n${statusSummary}\n\nПоследняя ошибка: ${lastError}`,
          isStreaming: false 
        } : m)
      } : s));
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s,
        messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m)
      } : s));
    }

    setIsGenerating(false);
    abortControllerRef.current = null;
  }, [activeSessionId, sessions, settings, isGenerating]);

  const deployToGitHub = useCallback(async () => {
    sendMessage("Пользователь отправил игру на модерацию.", true);
  }, [sendMessage]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
    }
  }, []);

  return {
    sessions,
    activeSessionId,
    currentSession,
    modelProgress,
    isGenerating,
    isPipelineRunning,
    isAutoDeploying,
    settings,
    generationStep,
    usage,
    sendMessage,
    deployToGitHub,
    stopGeneration,
    updateSettings: (s: Partial<ChatSettings>) => setSettings(prev => ({ ...prev, ...s })),
    createNewChat: () => {
      const s = createDefaultSession();
      setSessions([s, ...sessions]);
      setActiveSessionId(s.id);
    },
    switchSession: (id: string) => setActiveSessionId(id),
    deleteSession: (id: string) => {
      const filtered = sessions.filter(s => s.id !== id);
      setSessions(filtered.length ? filtered : [createDefaultSession()]);
      if (id === activeSessionId) setActiveSessionId(filtered[0]?.id || "");
    },
    clearAllSessions: () => {
      const s = createDefaultSession();
      setSessions([s]);
      setActiveSessionId(s.id);
    },
    factoryReset: () => {
      localStorage.clear();
      window.location.reload();
    },
    retryLastMessage: () => {}
  };
}
