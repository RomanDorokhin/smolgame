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
import { parseAiderBlocks, applyAiderBlocks, AIDER_EDITOR_PROMPT } from "../lib/aider-utils";

const SESSIONS_KEY = "smol_chat_sessions_v3";
const ACTIVE_SESSION_KEY = "smol_active_session_id_v3";
const SETTINGS_KEY = "smol_chat_settings_v3";
const USAGE_KEY = "smol_chat_usage_v3";

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "together", "sambanova", "glhf", "deepseek", "openrouter", "huggingface", "custom"];

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}

function cleanTechnicalContent(text: string) {
  // Catch any variation of opengame_prompt or game_spec with <, [, or /
  const tagMatch = text.match(/[<\[\/]?(opengame_prompt|game_spec)[>\]\s]?/i);
  if (tagMatch && tagMatch.index !== undefined) {
    const baseText = text.substring(0, tagMatch.index);
    return (baseText + '\n\n⚙️ **[Инструкции для движка OpenGame переданы]**').trim();
  }
  
  return text.trim();
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

  const handleOpenGameFlow = async (sessionId: string, assistantMsgId: string, prompt: string, currentSettings: ChatSettings, currentContent: string, initialProvider: string) => {
    let failureLog: string[] = [];
    setGenerationStep(`Запуск внутренней генерации...`);
    setIsPipelineRunning(true);
    
    const startMsg = `\n\n🚀 **Пайплайн запущен.** Подключаю инженера...`;
    
    // Sync to session immediately
    setSessions(prev => prev.map(s => s.id === sessionId ? { 
      ...s, 
      isPipelineRunning: true, 
      pipelineStep: "Запуск...",
      messages: s.messages.map(m => m.id === assistantMsgId ? { 
        ...m, 
        content: cleanTechnicalContent(currentContent) + startMsg 
      } : m)
    } : s));

    try {
      // 1. Generate the code directly using the LLM pool with Bulldozer logic
      setGenerationStep(`Генерация кода (запуск цикла отказоустойчивости)...`);
      
      const generationPrompt = `You are the OpenGame Core Agent. You MUST build the game according to the OPENGAME DEBUG PROTOCOL.

PHASE 1: PRE-BUILD VERIFICATION (OPENGAME STANDARDS)
Before outputting code, verify:
- ANIMATION SYSTEM: 3-Layer check (asset-pack -> animations -> code keys).
- CONFIG ALIGNMENT: All gameConfig.json keys MUST match code references.
- UI COMPONENTS: Must have Start, HUD, and Game Over screens.
- MOBILE OPTIMIZATION: Portrait mode, touch-first inputs (>44px targets).
- SCENE MANAGEMENT: All scenes MUST be registered in a central game config.

PHASE 2: CORE IMPLEMENTATION RULES
- SINGLE-FILE: HTML + CSS + JS in one self-contained block.
- PERFORMANCE: Use requestAnimationFrame. Avoid global leaks.
- ERROR HANDLING: Wrap critical game loops in try-catch for "Skill Debug" compliance.
- REPLAYABILITY: Persistent high scores in localStorage.

PHASE 3: EXECUTION & AUTO-DEPLOY
Write the COMPLETE code. Include a <thought> block first where you verify the checklist above.
Your goal is to pass the internal Quality Gate (60+) and trigger an IMMEDIATE GitHub push. Do NOT ask for manual testing.

SPECIFICATION:
${prompt}

[PIPELINE_START]
Output within <game_spec> tags.`;

      let finalRawCode = "";
      let attempts = 0;
      const maxTotalAttempts = 15;

      // Prepare a list of providers to try, starting with the one that generated the prompt
      const providersWithKeys = FALLBACK_ORDER.filter(p => {
        const k = currentSettings.keys[p];
        return k && typeof k === 'string' && k.trim().length > 0;
      });
      
      if (providersWithKeys.length === 0) {
        throw new Error("Нет доступных ключей API для генерации кода. Проверьте настройки.");
      }

      // Prioritize the provider that successfully generated the opengame_prompt
      const originalProvider = providersWithKeys.includes(initialProvider as any) ? initialProvider : null;
      const otherProviders = providersWithKeys.filter(p => p !== originalProvider);
      const rotatedProviders = originalProvider ? [originalProvider as APIProvider, ...otherProviders] : providersWithKeys;

      console.log("[Pipeline] Starting with providers:", rotatedProviders);

      for (const currentProvider of rotatedProviders) {
        attempts++;
        if (attempts > maxTotalAttempts) break;

        const keyVal = currentSettings.keys[currentProvider];
        const key = typeof keyVal === 'string' ? keyVal.trim() : "";
        
        if (!key || key.length === 0) {
          console.warn(`[Pipeline] Skipping ${currentProvider} - key missing (type: ${typeof keyVal})`);
          failureLog.push(`${currentProvider}: Ключ отсутствует в настройках (тип: ${typeof keyVal})`);
          continue; 
        }

        const modelId = currentSettings.models[currentProvider] || (Array.isArray(DEFAULT_MODELS[currentProvider]) ? DEFAULT_MODELS[currentProvider][0] : DEFAULT_MODELS[currentProvider]);

        try {
          const stepMsg = `\n\n⚙️ **Инженер (${currentProvider})** анализирует ТЗ...`;
          setGenerationStep(`Инженер (${currentProvider}) анализирует ТЗ...`);
          setSessions(prev => prev.map(s => s.id === sessionId ? {
            ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
              ...m, content: cleanTechnicalContent(currentContent) + stepMsg 
            } : m)
          } : s));

          let generatedResponse = "";
          try {
            const stream = generateStream(
              [{ role: "user", content: generationPrompt }],
              { provider: currentProvider, model: modelId, apiKey: key },
              new AbortController().signal
            );

            for await (const chunk of stream) {
              generatedResponse += chunk;
              // Update step to show it's actually working
              if (generatedResponse.length % 50 === 0) {
                setGenerationStep(`Инженер (${currentProvider}) пишет код (${generatedResponse.length} зн.)...`);
              }
            }
          } catch (streamErr: any) {
            console.error(`Stream error with ${currentProvider}:`, streamErr);
            failureLog.push(`${currentProvider}: ${streamErr.message}`);
            setGenerationStep(`Ошибка ${currentProvider}: ${streamErr.message.slice(0, 30)}...`);
            continue; // Try next provider
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
          console.warn(`Attempt with ${currentProvider} failed:`, err.message);
          failureLog.push(`${currentProvider}: ${err.message}`);
          setGenerationStep(`Сбой ${currentProvider}. Пробую следующую...`);
        }
      }

      if (!finalRawCode) {
        const missingKeys = failureLog.filter(l => l.includes("empty or invalid") || l.includes("отсутствует")).map(l => l.split(':')[0].trim());
        const debugKeys = Object.keys(currentSettings.keys).map(k => `${k}(${typeof currentSettings.keys[k as APIProvider]})`).join(', ');
        let errorMsg = `Все модели провалены:\n${failureLog.map(l => `• ${l}`).join('\n')}\n\n[Debug: ${debugKeys}]`;
        
        if (missingKeys.length > 0) {
          errorMsg += `\n\n⚠️ **Внимание:** Похоже, у тебя не введены или не сохранились ключи для: **${missingKeys.join(', ')}**. \nПроверь вкладку **API Orchestrator** в боковой панели.`;
        }
        
        throw new Error(errorMsg);
      }

      if (finalRawCode) {
        setGenerationStep(`Оптимизация и проверка...`);
        let result = await runGamePipeline(sessionId, finalRawCode);
        
        // --- SELF-CORRECTION LOOP ---
        if (result.score < 90) {
          const feedback = result.checks
            .filter(c => c.status === 'fail')
            .map(c => `- ${c.requirement}: ${c.feedback}`)
            .join('\n');
          
          setGenerationStep(`Самокоррекция (тек. балл: ${result.score})...`);
          
          const correctionPrompt = `Твой предыдущий код получил ${result.score}/100 баллов. Нужно исправить следующие ошибки, чтобы достичь 100/100:
${feedback}

Верни ПОЛНЫЙ, ИСПРАВЛЕННЫЙ код игры.`;

          try {
            // Try to fix using the same provider
            const key = currentSettings.keys[currentProvider] || localStorage.getItem("smol_settings") ? JSON.parse(localStorage.getItem("smol_settings")!).keys[currentProvider] : "";
            const stream = generateStream(
              [{ role: "user", content: generationPrompt }, { role: "assistant", content: finalRawCode }, { role: "user", content: correctionPrompt }],
              { provider: currentProvider, model: currentSettings.models[currentProvider] || (Array.isArray(DEFAULT_MODELS[currentProvider]) ? DEFAULT_MODELS[currentProvider][0] : DEFAULT_MODELS[currentProvider]), apiKey: key },
              new AbortController().signal
            );

            let fixedCode = "";
            for await (const chunk of stream) {
              fixedCode += chunk;
            }

            const codeMatch = fixedCode.match(/<html[\s\S]*<\/html>/i);
            if (codeMatch) {
              finalRawCode = codeMatch[0];
              result = await runGamePipeline(sessionId, finalRawCode);
            }
          } catch (e) {
            console.warn("Self-correction pass failed, using original code", e);
          }
        }
        // --- END SELF-CORRECTION ---

        // Final message update - USING THE CORRECT finalScore FIELD
        const finalScore = result?.finalScore !== undefined ? result.finalScore : "???";
        const finalStatusMsg = `\n\n✅ **Игра готова! (Качество: ${finalScore}/100)**\n\nТы можешь запустить её кнопкой ниже или скопировать код.`;
        
        setSessions(prev => prev.map(s => s.id === sessionId ? {
          ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { 
            ...m, 
            content: cleanTechnicalContent(currentContent) + finalStatusMsg,
            pipelineResult: { ...result, score: finalScore, generatedCode: finalRawCode }
          } : m)
        } : s));

        // GitHub Publish Logic - Threshold is 60. Use backend session.
        if (typeof finalScore === 'number' && finalScore >= 60) {
          const gameTitle = finalRawCode.match(/<title>([^<]{1,60})<\/title>/i)?.[1]?.trim() || "Smol Game";
          
          setIsAutoDeploying(true);
          setGenerationStep(`Публикация на GitHub...`);
          
          try {
            const deployResult = await SmolGameAPI.publishGame({ 
              gameTitle, 
              files: [{ path: "index.html", content: finalRawCode }], 
              gameDescription: "AI Generated via Smol Agent (OpenGame Engine)" 
            });
            
            if (deployResult.ok) {
              const pushStatus = `\n\n🚀 **Игра опубликована на GitHub!**\n🔗 [Посмотреть код](https://github.com/${deployResult.repo})\n🌐 [Играть (Pages)]( ${deployResult.pagesUrl} )`;
              
              setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s, messages: s.messages.map(m => m.id === assistantMsgId ? {
                  ...m, 
                  content: m.content + pushStatus,
                  pipelineResult: { ...result, score: finalScore, autoDeployed: true, generatedCode: finalRawCode },
                  deployResult: { pagesUrl: deployResult.pagesUrl, repoUrl: `https://github.com/${deployResult.repo}`, pagesReady: deployResult.pagesReady }
                } : m)
              } : s));
            } else {
               const errorMsg = deployResult.error || JSON.stringify(deployResult);
               const pushError = `\n\n❌ **Ошибка публикации на GitHub:** ${errorMsg}`;
               
               setSessions(prev => prev.map(s => s.id === sessionId ? {
                ...s, messages: s.messages.map(m => m.id === assistantMsgId ? {
                  ...m, 
                  content: m.content + pushError
                } : m)
              } : s));
               console.error("Deploy failed with status:", deployResult.status, deployResult);
            }
          } catch (e: any) {
            console.error("Deploy Exception:", e);
            const netError = `\n\n❌ **Критическая ошибка сети при пуше:** ${e.message}`;
            setSessions(prev => prev.map(s => s.id === sessionId ? {
              ...s, messages: s.messages.map(m => m.id === assistantMsgId ? { ...m, content: m.content + netError } : m)
            } : s));
          } finally { setIsAutoDeploying(false); }
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

    const session = sessionsRef.current.find(s => s.id === sessionId);
    const messageHistory = [...(session?.messages || []), userMsg];
    const isEditMode = !!session?.editTarget;

    // Reset pool status for manual retries
    FALLBACK_ORDER.forEach(p => pool.reset(p));

    setIsGenerating(true);
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 minutes

    try {
      let systemPrompt = "";
      let isComplete = false;

      if (isEditMode && session?.editTarget) {
        systemPrompt = AIDER_EDITOR_PROMPT + `\n\nCURRENT FILE CONTENT (${session.editTarget.path}):\n\`\`\`html\n${session.editTarget.currentCode}\n\`\`\``;
      } else {
        if (!orchestratorRef.current) orchestratorRef.current = new GameFlowOrchestratorV2("user-1", sessionId);
        const orchestrator = orchestratorRef.current;
        const currentAnswers = orchestrator.getSession().answers || {};
        isComplete = orchestrator.isInterviewComplete();
        const FIELD_NAMES: Record<string, string> = { genre: "Жанр", mechanics: "Механика", visuals: "Визуал", audience: "Аудитория", story: "Сюжет", progression: "Прогрессия", special_features: "Фишки" };
        const missingFields = ['genre', 'mechanics', 'visuals', 'audience', 'story', 'progression', 'special_features'].filter(f => !(currentAnswers as any)[f]);
        const nextField = missingFields[0];

        const QUALITY_CRITERIA = `
  1. TECHNICAL: Single HTML file, no backend, works in iframe, touch-first, portrait only, no system dialogs.
  2. GAMEPLAY: Instant action, honest game over, balanced, no bugs, replayability.
  3. UX: Tap zones 44px+, font 16px+, sound after tap, smooth performance.
  4. VISUAL: Own style, Russian/Visual-only, no violence.
  5. DEMO: Mandatory ?demo=1, real gameplay, loopable.`;

        systemPrompt = `Ты — Элитный Геймдизайнер SmolGame. Твоя задача — собрать требования.

  ПРАВИЛА:
  1. Задавай ТОЛЬКО ОДИН уточняющий вопрос.
  2. Когда всё ясно (у тебя есть жанр, механика и визуал) — выводи <opengame_prompt> со всеми деталями.
  3. ИСПОЛЬЗУЙ ТОЛЬКО XML ТЕГИ <opengame_prompt>...</opengame_prompt>. НИКАКИХ СЛЕШЕЙ ТИПА /opengame_prompt.
  4. ПОСЛЕ ВЫВОДА ТЕГА <opengame_prompt> ТЫ ДОЛЖЕН НЕМЕДЛЕННО ЗАМОЛЧАТЬ. Никакого текста после тега.
  5. НИКОГДА не пытайся играть в игру в чате. Ты — интервьюер, а не движок.

  ВНУТРИ <opengame_prompt> ОБЯЗАТЕЛЬНО ВКЛЮЧИ: ${QUALITY_CRITERIA}

  ${isComplete ? `ЗАДАЧА: Сформируй финальное ТЗ внутри <opengame_prompt>.` : `ВОПРОС ПРО ${FIELD_NAMES[nextField || 'genre']}.`}`;
      }

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
              const stream = generateStream([{ role: "system", content: systemPrompt }, ...messageHistory.map(m => ({ role: m.role as any, content: m.content })), { role: "user", content }], {
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
                
                // Delimiter-agnostic prompt detection (supports <>, [], /, or plain)
                const promptMatch = fullContent.match(/(?:<|\[|\/)?opengame_prompt(?:>|\]|\s+)([\s\S]+)/i);
                                 
                  if (promptMatch) {
                    // ... existing opengame_prompt logic ...
                    let spec = promptMatch[1]
                      .replace(/<\/opengame_prompt>/i, '')
                      .replace(/\]/g, '')
                      .replace(/\/about[\s\S]*/i, '')
                      .trim();
                    await handleOpenGameFlow(sessionId, assistantMsg.id, spec, settings, fullContent, provider);
                  } else if (isEditMode) {
                    // AIDER EDIT LOGIC
                    const blocks = parseAiderBlocks(fullContent);
                    if (blocks.length > 0) {
                      const currentCode = sessionsRef.current.find(s => s.id === sessionId)?.editTarget?.currentCode || "";
                      const editResult = applyAiderBlocks(currentCode, blocks);
                      
                      setSessions(prev => prev.map(s => s.id === sessionId ? {
                        ...s,
                        editTarget: s.editTarget ? { ...s.editTarget, currentCode: editResult.code } : undefined,
                        messages: s.messages.map(m => m.id === assistantMsg.id ? {
                          ...m,
                          content: fullContent + `\n\n✅ **Применено правок: ${editResult.appliedCount}**` + (editResult.failedBlocks.length > 0 ? `\n⚠️ Не удалось применить: ${editResult.failedBlocks.length}` : "")
                        } : m)
                      } : s));
                    }
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
    },
    startEditing: async (repoUrl: string) => {
      setGenerationStep("Загрузка кода игры...");
      setIsGenerating(true);
      try {
        // Extract repo from URL (e.g. https://github.com/owner/repo -> owner/repo)
        let repo = repoUrl.replace('https://github.com/', '').split('/').slice(0, 2).join('/');
        const data = await SmolGameAPI.getGameFile(repo);
        
        const newId = generateId();
        const newSession: ChatSession = {
          id: newId,
          title: `Правка: ${repo.split('/')[1]}`,
          messages: [{
            id: generateId(),
            role: "assistant",
            content: `Я загрузил код игры из репозитория \`${repo}\`. Что именно вы хотите исправить или добавить?`,
            timestamp: Date.now()
          }],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          modelName: "auto",
          editTarget: {
            repo,
            path: data.path,
            sha: data.sha,
            originalCode: data.content,
            currentCode: data.content
          }
        };
        
        setSessions(prev => [newSession, ...prev]);
        setActiveSessionId(newId);
      } catch (e: any) {
        alert("Не удалось загрузить игру: " + e.message);
      } finally {
        setIsGenerating(false);
        setGenerationStep("");
      }
    },
    saveChanges: async () => {
      const session = sessionsRef.current.find(s => s.id === activeSessionId);
      if (!session?.editTarget) return;
      
      setGenerationStep("Сохранение правок на GitHub...");
      setIsGenerating(true);
      try {
        const result = await SmolGameAPI.updateGameFile({
          repo: session.editTarget.repo,
          path: session.editTarget.path,
          content: session.editTarget.currentCode,
          sha: session.editTarget.sha,
          message: "Update via Smol Agent (Aider-style edit)"
        });
        
        if (result.ok) {
          setSessions(prev => prev.map(s => s.id === activeSessionId ? {
            ...s,
            editTarget: s.editTarget ? { ...s.editTarget, sha: result.sha, originalCode: s.editTarget.currentCode } : undefined,
            messages: [...s.messages, {
              id: generateId(),
              role: "assistant",
              content: "✅ **Изменения успешно сохранены в репозиторий!**",
              timestamp: Date.now()
            }]
          } : s));
        }
      } catch (e: any) {
        alert("Ошибка при сохранении: " + e.message);
      } finally {
        setIsGenerating(false);
        setGenerationStep("");
      }
    }
  };
}
