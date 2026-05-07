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
import { generateStream, pool, DEFAULT_MODELS, fetchAvailableModels } from "../lib/llm-api";
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

function cleanTechnicalContent(text: string) {
  // If the text contains the prompt, we ONLY keep what's BEFORE it to prevent roleplay/leakage
  const promptIndex = text.indexOf('<opengame_prompt>');
  let baseText = promptIndex !== -1 ? text.substring(0, promptIndex) : text;
  
  // Replace opengame_prompt blocks with a placeholder for the UI
  let cleaned = baseText + '\n\n⚙️ **[Инструкции для движка OpenGame переданы]**\n';
  
  // Also hide game_spec tags just in case
  cleaned = cleaned.replace(/<game_spec>[\s\S]*?<\/game_spec>/g, '');
  return cleaned.trim();
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
  const [lastProviderIndex, setLastProviderIndex] = useState(0);
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

  // Cleanup: Reset stalled pipeline states on mount
  useEffect(() => {
    setSessions(prev => prev.map(s => ({ 
      ...s, 
      isPipelineRunning: false, 
      pipelineStep: s.isPipelineRunning ? "Прервано (обнови страницу)" : s.pipelineStep 
    })));
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

  const currentSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || createDefaultSession();

  const handleOpenGameFlow = async (sessionId: string, assistantMsgId: string, prompt: string, apiKey: string, model: string, provider: string, currentContent: string) => {
    setGenerationStep(`Запуск внутренней генерации...`);
    setIsPipelineRunning(true);
    
    // Sync to session immediately
    setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isPipelineRunning: true, pipelineStep: "Запуск..." } : s));

    try {
      // 1. Generate the code directly using the LLM pool with Bulldozer logic
      setGenerationStep(`Генерация кода (запуск цикла отказоустойчивости)...`);
      
      const generationPrompt = `You are the OpenGame Implementation Engine. 
      TASK: Implement the game described in this spec:
      ${prompt}
      
      INSTRUCTIONS:
      1. If you have enough info, output the full index.html code inside <game_spec> tags.
      2. If the spec is critically incomplete or contradictory, ask a short clarification question (WITHOUT tags).
      3. Use professional, modern, animated style. Adhere to all quality standards.
      4. Language: UI in Russian, Code in English.`;

      let finalRawCode = "";
      let attempts = 0;
      const maxTotalAttempts = 5;

      while (attempts < maxTotalAttempts) {
        attempts++;
        const currentProvider = FALLBACK_ORDER[(lastProviderIndex + attempts - 1) % FALLBACK_ORDER.length];
        const key = settings.keys[currentProvider];
        const modelId = settings.models[currentProvider] || DEFAULT_MODELS[currentProvider];

        if (!key) continue;

        try {
          setGenerationStep(`Инженер (${currentProvider}) анализирует ТЗ...`);
          let generatedResponse = "";
          const stream = await generateStream(
            [{ role: "user", content: generationPrompt }],
            { provider: currentProvider, model: modelId, key },
            new AbortController().signal
          );

          for await (const chunk of stream) {
            generatedResponse += chunk;
          }

          const codeMatch = generatedResponse.match(/<game_spec>([\s\S]*?)<\/game_spec>/);
          
          if (codeMatch) {
            finalRawCode = codeMatch[1].trim();
            break; // Success! We have code.
          } else if (generatedResponse.length > 20 && !generatedResponse.includes('<html>')) {
            // It's likely a question or clarification
            setSessions(prev => prev.map(s => s.id === sessionId ? {
              ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
                ...m, content: cleanTechnicalContent(currentContent) + `\n\n🛠 **Уточнение от инженера OpenGame:**\n${generatedResponse}` 
              } : m)
            } : s));
            return; // Stop and wait for user input
          }
        } catch (err: any) {
          console.warn(`Attempt ${attempts} failed for ${currentProvider}:`, err);
          if (attempts >= maxTotalAttempts) throw err;
          await new Promise(r => setTimeout(r, 3000));
        }
      }

      if (finalRawCode) {
        setGenerationStep(`Оптимизация и проверка...`);
        const result = await runGamePipeline(sessionId, finalRawCode);
        
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
            ...m, content: cleanTechnicalContent(currentContent) + "\n\n✅ **Игра готова!**", pipelineResult: result 
          } : m)
        } : s));

        if (result.isPublishable) {
          const gameTitle = finalRawCode.match(/<title>([^<]{1,60})<\/title>/i)?.[1]?.trim() || "Smol Game";
          if ((window as any).__smolAuthUser?.isGithubConnected) {
            setIsAutoDeploying(true);
            setGenerationStep(`Публикация на GitHub...`);
            try {
              const deployResult = await SmolGameAPI.publishGame({ 
                gameTitle, 
                files: [{ path: "index.html", content: result.generatedCode }], 
                gameDescription: "AI Generated via Smol Agent (Bulldozer Mode)" 
              });
              if (deployResult.ok) {
                setSessions(prev => prev.map(s => s.id === sessionId ? {
                  ...s, messages: s.messages.map(m => m.id === assistantMsgId ? {
                    ...m, pipelineResult: { ...result, autoDeployed: true },
                    deployResult: { pagesUrl: deployResult.pagesUrl, repoUrl: `https://github.com/${deployResult.repo}`, pagesReady: deployResult.pagesReady }
                  } : m)
                } : s));
              }
            } catch (e) {
              console.error("Deploy failed:", e);
            } finally { setIsAutoDeploying(false); }
          } else { 
            SmolGameAPI.savePendingGame({ htmlCode: result.generatedCode, title: gameTitle }); 
          }
        }
      }
    } catch (e: any) {
      console.error("Generation Pipeline Error:", e);
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
          ...m, content: cleanTechnicalContent(currentContent) + `\n\n❌ **Ошибка генерации:** ${e.message}` 
        } : m)
      } : s));
    } finally {
      setIsPipelineRunning(false);
      setGenerationStep("");
      setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isPipelineRunning: false, pipelineStep: "" } : s));
    }
  };

  const sendMessage = useCallback(async (content: string, isHidden: boolean = false) => {
    if (isGenerating && !isHidden) return;

    const userMsg: ChatMessage = { id: generateId(), role: "user", content, timestamp: Date.now(), isHidden };
    const assistantMsg: ChatMessage = { id: generateId(), role: "assistant", content: "", timestamp: Date.now(), isStreaming: true };

    let sessionId = activeSessionId;
    if (!sessionId || !sessionsRef.current.find(s => s.id === sessionId)) {
      const newId = generateId();
      const newSession: ChatSession = {
        id: newId, title: content.slice(0, 30), messages: [userMsg, assistantMsg], createdAt: Date.now(), updatedAt: Date.now()
      };
      setSessions(prev => [newSession, ...prev]);
      setActiveSessionId(newId);
      sessionId = newId;
    } else {
      setSessions(prev => prev.map(s => s.id === sessionId ? {
        ...s, messages: [...s.messages, userMsg, assistantMsg], updatedAt: Date.now(), title: s.title === "New Chat" ? content.slice(0, 30) : s.title
      } : s));
    }

    const messageHistory = [...(sessionsRef.current.find(s => s.id === sessionId)?.messages || []), userMsg];

    // Reset pool status for manual retries
    FALLBACK_ORDER.forEach(p => pool.reset(p));

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
      if (!orchestratorRef.current) orchestratorRef.current = new GameFlowOrchestratorV2("user-1", sessionId);
      const orchestrator = orchestratorRef.current;
      const currentAnswers = orchestrator.getSession().answers || {};
      const isComplete = orchestrator.isInterviewComplete();
      
      const FIELD_NAMES: Record<string, string> = { genre: "Жанр", mechanics: "Механика", visuals: "Визуал", audience: "Аудитория", story: "Сюжет", progression: "Прогрессия", special_features: "Фишки" };
      const missingFields = ['genre', 'mechanics', 'visuals', 'audience', 'story', 'progression', 'special_features'].filter(f => !(currentAnswers as any)[f]);
      const nextField = missingFields[0];

      const QUALITY_CRITERIA = `
1. TECHNICAL: Single HTML file, no backend, works in iframe, touch-first, portrait only, no system dialogs.
2. GAMEPLAY: Instant action, honest game over, balanced, no bugs, replayability.
3. UX: Tap zones 44px+, font 16px+, sound after tap, smooth performance.
4. VISUAL: Own style, Russian/Visual-only, no violence.
5. DEMO: Mandatory ?demo=1, real gameplay, loopable.`;

      const SMART_SYSTEM_PROMPT = `Ты — Элитный Геймдизайнер SmolGame. Твоя задача — собрать требования.

ПРАВИЛА:
1. Задавай ТОЛЬКО ОДИН уточняющий вопрос.
2. Когда всё ясно (у тебя есть жанр, механика и визуал) — выводи <opengame_prompt> со всеми деталями.
3. ПОСЛЕ ВЫВОДА ТЕГА <opengame_prompt> ТЫ ДОЛЖЕН НЕМЕДЛЕННО ЗАМОЛЧАТЬ. Никакого текста после тега.
4. НИКОГДА не пытайся играть в игру в чате. Ты — интервьюер, а не движок.

ВНУТРИ <opengame_prompt> ОБЯЗАТЕЛЬНО ВКЛЮЧИ: ${QUALITY_CRITERIA}

${isComplete ? `ЗАДАЧА: Сформируй финальное ТЗ внутри <opengame_prompt>.` : `ВОПРОС ПРО ${FIELD_NAMES[nextField || 'genre']}.`}`;

      // 1. Prepare providers with keys and rotate start point
      const providersWithKeys = FALLBACK_ORDER.filter(p => !!settings.keys[p]);
      if (providersWithKeys.length === 0) {
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, messages: [...s.messages, { id: generateId(), role: "assistant", content: "❌ **Ошибка: Ключи API не найдены.** Пожалуйста, добавь ключи (Gemini, Groq, и т.д.) в настройках.", timestamp: Date.now() }]
        } : s));
        setIsGenerating(false);
        return;
      }

      // Rotate starting index for Round-Robin
      const startIndex = (lastProviderIndex + 1) % providersWithKeys.length;
      setLastProviderIndex(startIndex);

      // Re-order providers to start from the rotated index
      const rotatedProviders = [
        ...providersWithKeys.slice(startIndex),
        ...providersWithKeys.slice(0, startIndex)
      ];

      let success = false;
      let failureLog: string[] = [];

      for (const provider of rotatedProviders) {
        if (success || controller.signal.aborted) break;
        const apiKey = settings.keys[provider];
        if (!apiKey) continue;

        const primaryModel = settings.models[provider] || (DEFAULT_MODELS[provider] ? DEFAULT_MODELS[provider][0] : "");
        const fallbackModels = DEFAULT_MODELS[provider] || [];
        const modelsToTry = Array.from(new Set([primaryModel, ...fallbackModels])).filter(m => !!m);

        if (provider === "openrouter") {
          try {
            const fresh = await fetchAvailableModels("openrouter", apiKey);
            modelsToTry.push(...fresh.filter(m => m.isFree).map(m => m.id));
          } catch {}
        }

        for (const modelId of modelsToTry) {
          if (success || controller.signal.aborted) break;
          
          let retries = 0;
          const maxRetries = 2;

          while (retries <= maxRetries && !success && !controller.signal.aborted) {
            setGenerationStep(`Пробую ${provider}: ${modelId.split('/').pop()}... ${retries > 0 ? `(повтор ${retries})` : ''}`);

            try {
              const stream = generateStream([{ role: "system", content: SMART_SYSTEM_PROMPT }, ...messageHistory.map(m => ({ role: m.role as any, content: m.content })), { role: "user", content }], {
                provider, apiKey, model: modelId, baseUrl: settings.customBaseUrl
              }, controller.signal);

              let fullContent = "";
              let isFirst = true;

              for await (const chunk of stream) {
                if (isFirst) { 
                  success = true; 
                  isFirst = false; 
                  setGenerationStep(isComplete ? "Сборка ТЗ..." : "Анализ..."); 
                }
                fullContent += chunk;
                setSessions(prev => prev.map(s => s.id === sessionId ? {
                  ...s, messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, content: cleanTechnicalContent(fullContent) } : m)
                } : s));
              }

              if (success) {
                setUsage(prev => ({ ...prev, requests: { ...prev.requests, [provider]: (prev.requests[provider] || 0) + 1 } }));
                const promptMatch = fullContent.match(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/);
                if (promptMatch) {
                  await handleOpenGameFlow(sessionId, assistantMsg.id, promptMatch[1], apiKey, modelId, provider, fullContent);
                }
                break;
              }
            } catch (e: any) {
              const isRateLimit = e.message.includes("429");
              console.warn(`[useChat] Provider ${provider} model ${modelId} failed:`, e.message);
              
              if (isRateLimit && retries < maxRetries) {
                retries++;
                setGenerationStep(`Лимит ${provider}. Жду 10 сек...`);
                await new Promise(r => setTimeout(r, 10000));
                continue;
              }

              let cleanError = e.message;
              try { if (cleanError.includes('{')) { const json = JSON.parse(cleanError.split(': ').slice(1).join(': ')); cleanError = json.error?.message || cleanError; } } catch {}
              failureLog.push(`❌ **${provider} (${modelId.split('/').pop()})**: ${cleanError.slice(0, 80)}...`);
              break; // Move to next model
            }
          }
        }
      }

      if (!success) {
        const errorContent = `❌ **Не удалось получить ответ ни от одного провайдера.**\n\n**Лог попыток:**\n${failureLog.map(log => `- ${log}`).join("\n")}\n\n*Попробуй еще раз через минуту или добавь другие ключи в настройках.*`;
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, content: errorContent, isStreaming: false } : m)
        } : s));
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, messages: s.messages.map(m => m.id === assistantMsg.id ? { ...m, isStreaming: false } : m) } : s));
      }
    } finally {
      clearTimeout(timeoutId);
      setIsGenerating(false);
      setGenerationStep("");
    }
  }, [activeSessionId, sessions, settings, isGenerating]);

  return {
    sessions, activeSessionId, currentSession, modelProgress, isGenerating, isPipelineRunning, isAutoDeploying, settings, generationStep, usage,
    sendMessage, stopGeneration: () => abortControllerRef.current?.abort(),
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
    retryLastMessage: () => {
      const lastUser = [...currentSession.messages].reverse().find(m => m.role === "user");
      if (lastUser) {
        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
          ...s, messages: s.messages.filter(m => m.id !== lastUser.id && !m.isStreaming)
        } : s));
        sendMessage(lastUser.content);
      }
    }
  };
}
