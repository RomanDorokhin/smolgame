/**
 * useGameAgent v2 — Двухфазная архитектура как в старом useChat.ts
 *
 * Фаза 1: ИНТЕРВЬЮЕР собирает детали → выдаёт <opengame_prompt> тег
 * Фаза 2: ИНЖЕНЕР получает ТЗ → пишет полный код в <game_spec> тегах
 *
 * Использует проверенный generateStream из llm-api.ts (без Vercel AI SDK)
 */

import { useState, useRef, useCallback } from "react";
import { generateStream, pool, DEFAULT_MODELS } from "../lib/llm-api";
import type { APIProvider } from "../lib/llm-api";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { SmolGameAPI } from "../lib/smolgame-api";
import type { ChatSettings } from "../types/chat";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  gameCode?: string;
  pipelineResult?: any;
  deployResult?: any;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const FALLBACK_ORDER: APIProvider[] = [
  "groq", "gemini", "together", "openrouter", "deepseek", "sambanova", "huggingface"
];

// ──────────────────────────────────────────────
// ФАЗА 1: Промпт для интервьюера
// ──────────────────────────────────────────────
const INTERVIEWER_PROMPT = `Ты — Гейм-Архитектор SmolGame. Твоя задача — превратить идею пользователя в детальное техническое задание.

ПРАВИЛА:
1. АНАЛИЗИРУЙ НАМЕРЕНИЕ: Если пользователь уже дал достаточно деталей (жанр, механика, стиль), НЕ ЗАДАВАЙ лишних вопросов. Сразу переходи к выдаче <opengame_prompt>.
2. ТЕХНИЧЕСКИЙ ПЛАН: Внутри <opengame_prompt> обязательно пропиши технический стек (например: "Использовать Three.js для 3D" или "Canvas API с системой частиц").
3. ИНТЕРВЬЮ: Если деталей мало, задай ОДИН глубокий вопрос, который поможет определить уникальность игры.
4. ТЫ — ЭКСПЕРТ: Не просто записывай за пользователем, а предлагай лучшие технические решения для мобильных браузеров.

ВНУТРИ <opengame_prompt> СФОРМИРУЙ ПЛАН:
- Name: Название игры
- Tech Stack: Какие библиотеки/API использовать (Three.js, PixiJS, Canvas, WebAudio)
- Core Loop: Описание игрового цикла
- Mobile UX: Как именно будет работать управление тачем
- Visuals: Детальное описание стиля (цвета, шейдеры, эффекты)`;

// ──────────────────────────────────────────────
// ФАЗА 2: Промпт для инженера (генерация кода)
// ──────────────────────────────────────────────
const ENGINEER_PROMPT = `You are the SmolGame ELITE ENGINEER. Your mission is to build a high-performance, polished mobile game.

ARCHITECTURAL COMMANDMENTS:
1. PORTRAIT ONLY: The game MUST be designed for portrait orientation (aspect ratio roughly 9:16). Use 'height: 100vh' and 'width: 100vw'. Center the game canvas/container.
2. DEMO MODE: The game MUST have a 'Demo Mode' where the game plays itself if the user is idle on the start screen, or at least show a very active animated preview.
3. TOUCH FIRST: All controls must be touch-based. Use large, visible buttons or intuitive swipes. No hover effects.
4. NO EXTERNAL ASSETS: Use CSS gradients, SVG, Canvas drawing, or Emojis. No <img> tags to external sites.
5. PERFORMANCE: Use requestAnimationFrame for the game loop. Ensure it runs at 60fps.

STRICT PROTOCOL (REASONING LOOP):
1. PLAN: Define the game state structure and rendering strategy.
2. DRAFTING: Think about the core algorithms (collision, scoring, progression).
3. CRITIQUE: Self-critique the plan. Check specifically for Portrait Mode compatibility and Demo Mode logic.
4. FINAL BUILD: Generate the production-ready code.

Output Format:
<thought>
PLAN: ...
CRITIQUE: ...
</thought>
<game_spec>
...complete HTML file...
</game_spec>`;

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const chatHistory = useRef<{ role: "user" | "assistant" | "system"; content: string }[]>([]);

  const addMessage = useCallback((msg: Omit<AgentMessage, "id" | "timestamp">) => {
    const full: AgentMessage = { ...msg, id: makeId(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<AgentMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  // Получаем список провайдеров с ключами
  const getActiveProviders = useCallback(() => {
    return FALLBACK_ORDER.filter(p => {
      const key = settings.keys[p as keyof typeof settings.keys] as string | undefined;
      return key && key.trim().length > 0;
    });
  }, [settings]);

  // Стриминг через ротацию провайдеров
  const streamWithFallback = useCallback(async (
    msgs: { role: "user" | "assistant" | "system"; content: string }[],
    onChunk: (chunk: string, full: string) => void,
    signal: AbortSignal,
    preferredProvider?: string
  ): Promise<{ text: string; provider: string }> => {
    const active = getActiveProviders();
    if (active.length === 0) throw new Error("NO_KEYS");

    // Предпочитаемый провайдер ставим первым
    const ordered = preferredProvider && active.includes(preferredProvider as APIProvider)
      ? [preferredProvider as APIProvider, ...active.filter(p => p !== preferredProvider)]
      : active;

    let lastError = "";
    for (let i = 0; i < ordered.length; i++) {
      const providerId = ordered[i];
      if (signal.aborted) throw new Error("Cancelled");

      const status = pool.getStatus(providerId);
      if (status.state === "OPEN") {
        console.warn(`[Agent] Skipping tripped provider: ${providerId}`);
        continue;
      }

      const apiKey = settings.keys[providerId as keyof typeof settings.keys] as string;
      const model = (settings.models?.[providerId as keyof typeof settings.models] as string | undefined)
        || DEFAULT_MODELS[providerId]?.[0] || "gpt-3.5-turbo";

      try {
        if (i > 0) {
          // Если это не первый провайдер, значит предыдущий упал
          setStep(`🔄 Переключаюсь на ${providerId.toUpperCase()}...`);
        }

        let fullText = "";
        const stream = generateStream(msgs, { provider: providerId, apiKey, model }, signal);
        
        // Добавляем таймаут на начало ответа
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("TIMEOUT")), 15000)
        );

        for await (const chunk of stream) {
          if (signal.aborted) break;
          fullText += chunk;
          onChunk(chunk, fullText);
        }
        
        pool.reportSuccess(providerId);
        return { text: fullText, provider: providerId };
      } catch (e: any) {
        lastError = e.message || "Unknown";
        const isRate = lastError.includes("429") || lastError.toLowerCase().includes("rate limit") || lastError === "TIMEOUT";
        pool.reportFailure(providerId, isRate, lastError);
        console.warn(`[Agent] ${providerId} failed:`, lastError.slice(0, 80));
        
        // Если это был последний провайдер, пробрасываем ошибку дальше
        if (i === ordered.length - 1) break;
      }
    }
    throw new Error(`All providers failed. Last: ${lastError}`);
  }, [settings, getActiveProviders]);

  const sendMessage = useCallback(async (userText: string) => {
    if (isRunning) return;

    addMessage({ role: "user", content: userText });
    chatHistory.current.push({ role: "user", content: userText });

    const assistantId = addMessage({ role: "assistant", content: "🤔 ...", isStreaming: true });
    setIsRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    if (getActiveProviders().length === 0) {
      updateMessage(assistantId, {
        content: "❌ Нет API ключей. Открой настройки (≡) и добавь хотя бы один ключ.",
        isStreaming: false,
      });
      setIsRunning(false);
      return;
    }

    try {
      // ══════════════════════════════════════════
      // ФАЗА 1: Интервьюер собирает ТЗ
      // ══════════════════════════════════════════
      setStep("💬 Думаю...");

      const interviewMsgs = [
        { role: "system" as const, content: INTERVIEWER_PROMPT },
        ...chatHistory.current.slice(-16),
      ];

      let interviewText = "";
      let usedProvider = "";

      // Вырезаем тег opengame_prompt из видимого текста (LLM может писать как <тег> так и просто слово)
      const stripPromptTag = (text: string) =>
        text
          .replace(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/gi, "")
          .replace(/<\/?opengame_prompt>/gi, "")
          .replace(/opengame_prompt[\s\S]*/i, "") // без скобок тоже
          .trim();

      const { text: fullInterview, provider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;
          const hasTag = /<opengame_prompt>/i.test(full) || /opengame_prompt/i.test(full);
          const visible = stripPromptTag(full);
          updateMessage(assistantId, {
            content: hasTag
              ? (visible || "🚀 ТЗ собрано! Подключаю инженера...")
              : (visible || "🤔 ..."),
            isStreaming: true,
          });
        },
        signal
      );

      interviewText = fullInterview;
      usedProvider = provider;
      chatHistory.current.push({ role: "assistant", content: interviewText });

      // Ищем тег <opengame_prompt> — LLM может писать его по-разному
      const promptMatch =
        interviewText.match(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/i) ||
        interviewText.match(/<opengame_prompt>([\s\S]*?)$/i) ||
        interviewText.match(/opengame_prompt\s*([\s\S]+)/i); // без скобок

      // SMART SKIP: Если пользователь сразу дал детальное описание, Архитектор мог выдать промпт в первом же ответе.
      // Если тега нет, но сообщение длинное и похоже на ТЗ, мы можем принудительно запустить инженера.
      const isDetailedRequest = userText.length > 100 && (userText.includes("создай") || userText.includes("игру"));

      if (!promptMatch && !isDetailedRequest) {
        // Просто разговор — нет тега, показываем текст
        const visible = stripPromptTag(interviewText) || interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible, isStreaming: false });
        return;
      }

      // ══════════════════════════════════════════
      // ФАЗА 2: Инженер пишет код
      // ══════════════════════════════════════════
      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      
      // Ищем предыдущий код в истории для инкрементальных правок
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      // Текст до тега (если был)
      const tagStart = interviewText.search(/<opengame_prompt>|opengame_prompt/i);
      const beforeTag = tagStart > 0 ? interviewText.slice(0, tagStart).trim() : "";

      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 Пишу код игры...",
        isStreaming: true,
      });

      setStep("🔨 Инженер пишет код...");

      const engineerMsgs = [
        { 
          role: "system" as const, 
          content: ENGINEER_PROMPT + (previousCode ? `\n\nEXISTING CODE TO MODIFY:\n${previousCode}` : "")
        },
        { role: "user" as const, content: `Technical Plan / Instructions:\n\n${gameSpec}` },
      ];

      let rawCode = "";
      let engineerText = "";

      const { text: engineerResponse } = await streamWithFallback(
        engineerMsgs,
        (_chunk, full) => {
          engineerText = full;
          // Показываем прогресс пока накапливается код
          const lines = full.split("\n").length;
          const chars = full.length;
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `🔨 Инженер пишет код... (${chars} симв., ${lines} строк)`,
            isStreaming: true,
          });
        },
        signal,
        usedProvider // Предпочитаем тот же провайдер что уже работал
      );

      engineerText = engineerResponse;

      // Извлекаем код из <game_spec> тегов
      const codeMatch = engineerText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i)
        || engineerText.match(/```html([\s\S]*?)```/i)
        || engineerText.match(/<html[\s\S]*<\/html>/i);

      if (codeMatch) {
        rawCode = codeMatch[1]?.trim() || codeMatch[0]?.trim() || "";
        // Если извлекли из тегов — добавляем DOCTYPE если нет
        if (!rawCode.includes("<!DOCTYPE") && !rawCode.toLowerCase().startsWith("<html")) {
          rawCode = `<!DOCTYPE html>\n<html lang="ru">\n${rawCode}\n</html>`;
        }
      } else {
        // Попробуем взять весь ответ если там HTML
        const htmlMatch = engineerText.match(/<!DOCTYPE[\s\S]*/i);
        rawCode = htmlMatch?.[0] || engineerText;
      }

      if (!rawCode || rawCode.length < 500) {
        updateMessage(assistantId, {
          content: "❌ Инженер не вернул код игры. Попробуй ещё раз или смени провайдер в настройках.",
          isStreaming: false,
        });
        return;
      }

      // ══════════════════════════════════════════
      // ФАЗА 3: Проверка качества
      // ══════════════════════════════════════════
      setStep("🎮 Проверяю качество...");
      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + "🎮 Проверяю качество кода...",
        isStreaming: true,
      });

      let finalCode = rawCode;
      let score = 0;
      let pipeline: any = null;

      try {
        // --- ШАГ 1: Быстрая проверка (Пайплайн) ---
        pipeline = await runGamePipeline("agent-game", rawCode);
        score = pipeline.finalScore;

        // --- ШАГ 2: Умная проверка (Нейро-критик) ---
        setStep("🧠 Нейро-критик...");
        const criticMsgs = [
          { 
            role: "system" as const, 
            content: `You are the SmolGame MASTER CRITIC. Your job is to catch "fake" games that pass regex checks but are actually broken or empty.
            
            CHECKLIST:
            1. Logic: Is there a real game loop?
            2. Content: Is there actual gameplay code or just placeholders?
            3. Mobile: Are there large touch targets and portrait layout?
            4. Stability: Will it crash?
            
            Return JSON only:
            {
              "isFake": boolean,
              "realScore": number (0-100),
              "issues": string[]
            }` 
          },
          { role: "user" as const, content: `Review this code and the pipeline score (${score}/100):\n\nCODE:\n${rawCode}\n\nPIPELINE REPORT:\n${pipeline.summary}` },
        ];

        const { text: criticResponse } = await streamWithFallback(criticMsgs, () => {}, signal, usedProvider);
        
        try {
          const critique = JSON.parse(criticResponse.match(/\{[\s\S]*\}/)?.[0] || "{}");
          if (critique.isFake || critique.realScore < score) {
            score = critique.realScore;
            if (critique.issues) {
              pipeline.nextSteps = [...(pipeline.nextSteps || []), ...critique.issues];
            }
          }
        } catch (e) {
          console.error("Critic JSON parse failed", e);
        }

        // --- ШАГ 3: Авто-исправление (на основе критики) ---
        let attempts = 0;
        const maxAttempts = 2;

        while (score < 80 && attempts < maxAttempts && pipeline.nextSteps && pipeline.nextSteps.length > 0) {
          attempts++;
          setStep(`🔧 Авто-исправление (попытка ${attempts}/${maxAttempts})...`);
          
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `⚠️ **Качество: ${score}/100**. Исправляю замечания (${attempts}/${maxAttempts})...`,
            isStreaming: true,
          });

          const fixMsgs = [
            { 
              role: "system" as const, 
              content: ENGINEER_PROMPT + `\n\nCRITICAL FAILURE: YOUR PREVIOUS CODE FAILED QUALITY GATE (Score: ${score}/100).\n\nFIX THESE SPECIFIC ISSUES:\n${pipeline.nextSteps.join("\n")}\n\nEXISTING CODE:\n${finalCode}` 
            },
            { role: "user" as const, content: `REPAIR THE CODE. Return the COMPLETE fixed HTML in <game_spec> tags. NO PLACEHOLDERS.` },
          ];

          const { text: fixedResponse } = await streamWithFallback(
            fixMsgs,
            (_chunk, full) => {
              updateMessage(assistantId, {
                content: (beforeTag ? beforeTag + "\n\n" : "") + `🔧 Исправляю... (${full.length} симв.)`,
                isStreaming: true,
              });
            },
            signal,
            usedProvider
          );

          const fixedCodeMatch = fixedResponse.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) 
            || fixedResponse.match(/<html[\s\S]*<\/html>/i);
          
          if (fixedCodeMatch) {
            finalCode = fixedCodeMatch[1]?.trim() || fixedCodeMatch[0]?.trim();
            // Перепроверяем финальный вариант
            pipeline = await runGamePipeline("agent-game", finalCode);
            score = pipeline.finalScore;
            
            // Снова спрашиваем критика (опционально, но для скора полезно)
            const { text: reCritique } = await streamWithFallback([
              { role: "system", content: "Rate this code 0-100. Return JSON: {\"realScore\": number}" },
              { role: "user", content: finalCode }
            ], () => {}, signal, usedProvider);
            try {
              const r = JSON.parse(reCritique.match(/\{[\s\S]*\}/)?.[0] || "{}");
              if (r.realScore) score = r.realScore;
            } catch(e) {}
          }
        }

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\nТы можешь запустить её кнопкой ниже или скопировать код.`,
          gameCode: finalCode,
          pipelineResult: pipeline,
          isStreaming: true,
        });
      } catch (e) {
        // Ошибка в пайплайне — всё равно показываем оригинал
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `⚠️ **Игра создана** (проверка качества прервана)\n\nКод доступен для просмотра.`,
          gameCode: finalCode,
          isStreaming: true,
        });
      }

      // ══════════════════════════════════════════
      // ФАЗА 4: Публикация
      // ══════════════════════════════════════════
      
      // Проверяем авторизацию перед публикацией
      let isAuth = false;
      try {
        const me = await SmolGameAPI.getMe();
        isAuth = !!me.isGithubConnected;
      } catch (e) {
        isAuth = false;
      }

      if (!isAuth) {
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n📢 Подключи GitHub в настройках, чтобы опубликовать игру. А пока ты можешь запустить её в Студии!`,
          gameCode: finalCode,
          pipelineResult: pipeline,
          isStreaming: false,
        });
        setIsRunning(false);
        setStep("");
        return;
      }

      setStep("🚀 Публикую на GitHub...");
      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n🚀 **Публикую на GitHub...**`,
        gameCode: finalCode,
        isStreaming: true,
      });

      // Берём название из ТЗ
      const titleMatch = gameSpec.match(/(?:название|title|game)[\s:]*([^\n.]{3,40})/i);
      const gameTitle = titleMatch?.[1]?.trim() || "SmolGame";

      try {
        const publishResult = await SmolGameAPI.publishGame({
          gameTitle,
          files: [{ path: "index.html", content: finalCode }],
          gameDescription: `Generated by SmolGame Agent: ${gameSpec.slice(0, 100)}`,
        });

        if (publishResult.ok) {
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n🚀 **Опубликована на GitHub!**`,
            gameCode: finalCode,
            deployResult: {
              pagesUrl: publishResult.pagesUrl,
              repoUrl: `https://github.com/${publishResult.repo}`,
              pagesReady: publishResult.pagesReady,
            },
            isStreaming: false,
          });
          console.log("[Agent] Published successfully:", publishResult.pagesUrl);
        } else {
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n⚠️ Ошибка публикации: ${publishResult.error || "неизвестно"}`,
            gameCode: finalCode,
            isStreaming: false,
          });
        }
      } catch (pubErr: any) {
        console.error("[Agent] Publication failed:", pubErr);
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n❌ Ошибка сети при публикации.`,
          gameCode: finalCode,
          isStreaming: false,
        });
      }

    } catch (e: any) {
      if (e.message === "NO_KEYS") {
        updateMessage(assistantId, {
          content: "❌ Нет API ключей. Открой настройки (≡).",
          isStreaming: false,
        });
      } else if (e.message === "Cancelled") {
        updateMessage(assistantId, { content: "⏹️ Остановлено.", isStreaming: false });
      } else {
        const summary = pool.getSummary(getActiveProviders());
        updateMessage(assistantId, {
          content: `❌ Ошибка: ${e.message.slice(0, 200)}\n\n${summary}\n\nПроверь ключи в настройках (≡).`,
          isStreaming: false,
        });
      }
    } finally {
      setIsRunning(false);
      setStep("");
    }
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, streamWithFallback]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStep("");
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    chatHistory.current = [];
    FALLBACK_ORDER.forEach(p => pool.reset(p));
  }, []);

  return { messages, isRunning, step, sendMessage, stop, reset };
}
