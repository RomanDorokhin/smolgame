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
const INTERVIEWER_PROMPT = `Ты — Геймдизайнер SmolGame. Твоя задача — собрать детали для создания игры.

ПРАВИЛА:
1. Задавай ТОЛЬКО ОДИН уточняющий вопрос за раз.
2. Как только собрал жанр + механику + визуальный стиль — НЕМЕДЛЕННО выводи тег <opengame_prompt> с полным ТЗ.
3. ИСПОЛЬЗУЙ ТОЛЬКО XML ТЕГ <opengame_prompt>...</opengame_prompt>. Никаких слешей.
4. ПОСЛЕ ТЕГА <opengame_prompt> — МОЛЧИ. Никакого текста после тега.
5. НИКОГДА не описывай готовую игру, не пиши код в чате, не предлагай "варианты функций".
6. Ты — интервьюер. Не движок, не автор. Только сбор данных.

ВНУТРИ <opengame_prompt> ОБЯЗАТЕЛЬНО:
- Жанр и основная механика
- Визуальный стиль и тема
- Управление (touch-first, мобильные)
- Уникальная фишка
- Start Screen, HUD, Game Over Screen
- Сохранение рекорда в localStorage`;

// ──────────────────────────────────────────────
// ФАЗА 2: Промпт для инженера (генерация кода)
// ──────────────────────────────────────────────
const ENGINEER_PROMPT = `You are the SmolGame ELITE ENGINEER. Build a FULLY FUNCTIONAL, POLISHED, COMPLETE game.

STRICT RULES:
1. NO SKELETONS: All functions MUST be fully implemented.
2. NO PLACEHOLDERS: Never use comments like "// handle logic here".
3. SINGLE-FILE: Complete HTML + CSS + JS in one file.
4. MOBILE-FIRST: Large touch controls (44px+), portrait mode, no system dialogs.
5. MUST HAVE: requestAnimationFrame game loop, Start Screen, HUD, Game Over Screen, localStorage high scores.
6. MINIMUM: 5000 characters of code. Real gameplay, not a demo.
7. Output ONLY within <game_spec> tags. Nothing else.`;

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
    for (const providerId of ordered) {
      if (signal.aborted) throw new Error("Cancelled");

      const status = pool.getStatus(providerId);
      if (status.state === "OPEN") continue;

      const apiKey = settings.keys[providerId as keyof typeof settings.keys] as string;
      const model = (settings.models?.[providerId as keyof typeof settings.models] as string | undefined)
        || DEFAULT_MODELS[providerId]?.[0] || "gpt-3.5-turbo";

      try {
        let fullText = "";
        for await (const chunk of generateStream(msgs, { provider: providerId, apiKey, model }, signal)) {
          if (signal.aborted) break;
          fullText += chunk;
          onChunk(chunk, fullText);
        }
        pool.reportSuccess(providerId);
        return { text: fullText, provider: providerId };
      } catch (e: any) {
        lastError = e.message || "Unknown";
        const isRate = lastError.includes("429") || lastError.toLowerCase().includes("rate limit");
        pool.reportFailure(providerId, isRate, lastError);
        console.warn(`[Agent] ${providerId} failed:`, lastError.slice(0, 80));
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
      let foundPromptTag = false;

      const { text: fullInterview, provider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;

          // Показываем текст до тега
          const tagIdx = full.indexOf("<opengame_prompt>");
          const visible = tagIdx >= 0 ? full.slice(0, tagIdx).trim() : full.trim();

          if (tagIdx >= 0) {
            foundPromptTag = true;
            updateMessage(assistantId, {
              content: (visible || "🚀 ТЗ собрано! Подключаю инженера..."),
              isStreaming: true,
            });
          } else {
            updateMessage(assistantId, { content: visible || "🤔 ...", isStreaming: true });
          }
        },
        signal
      );

      interviewText = fullInterview;
      usedProvider = provider;
      chatHistory.current.push({ role: "assistant", content: interviewText });

      // Ищем тег <opengame_prompt>
      const promptMatch = interviewText.match(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/i)
        || interviewText.match(/<opengame_prompt>([\s\S]*?)$/i);

      if (!promptMatch) {
        // Просто разговор — нет тега, всё нормально
        const visible = interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible || interviewText, isStreaming: false });
        return;
      }

      // ══════════════════════════════════════════
      // ФАЗА 2: Инженер пишет код
      // ══════════════════════════════════════════
      const gameSpec = promptMatch[1].trim();
      const beforeTag = interviewText.slice(0, interviewText.indexOf("<opengame_prompt>")).trim();

      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 Пишу код игры...",
        isStreaming: true,
      });

      setStep("🔨 Инженер пишет код...");

      const engineerMsgs = [
        { role: "system" as const, content: ENGINEER_PROMPT },
        { role: "user" as const, content: `Build this game:\n\n${gameSpec}` },
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

      try {
        const pipeline = await runGamePipeline("agent-game", rawCode);
        score = pipeline.finalScore;
        finalCode = rawCode;

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! Качество: ${score}/100**\n\nТы можешь запустить её или скопировать код.`,
          gameCode: finalCode,
          pipelineResult: pipeline,
          isStreaming: true,
        });
      } catch (e) {
        // Качество не прошло — всё равно показываем код
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `⚠️ **Игра создана** (проверка качества не пройдена)\n\nКод доступен для просмотра.`,
          gameCode: finalCode,
          isStreaming: true,
        });
      }

      // ══════════════════════════════════════════
      // ФАЗА 4: Публикация
      // ══════════════════════════════════════════
      setStep("🚀 Публикую на GitHub...");
      updateMessage(assistantId, {
        content: updateMessage.toString(), // temp, will be overwritten
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
            content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (${score}/100)**\n\n🚀 Опубликована на GitHub!`,
            gameCode: finalCode,
            deployResult: {
              pagesUrl: publishResult.pagesUrl,
              repoUrl: `https://github.com/${publishResult.repo}`,
              pagesReady: publishResult.pagesReady,
            },
            isStreaming: false,
          });
        } else {
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (${score}/100)**`,
            gameCode: finalCode,
            isStreaming: false,
          });
        }
      } catch (pubErr) {
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (${score}/100)**`,
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
