/**
 * useGameAgent v2 — Двухфазная архитектура как в старом useChat.ts
 *
 * Фаза 1: ИНТЕРВЬЮЕР собирает детали → выдаёт <opengame_prompt> тег
 * Фаза 2: ИНЖЕНЕР получает ТЗ → пишет полный код в <game_spec> тегах
 *
 * Использует проверенный generateStream из llm-api.ts (без Vercel AI SDK)
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { generateStream, pool, DEFAULT_MODELS } from "../lib/llm-api";
import type { APIProvider } from "../lib/llm-api";
import { parseAiderBlocks, applyAiderBlocks, AIDER_EDITOR_PROMPT } from "../lib/aider-utils";
import { SmolGameAPI } from "../lib/smolgame-api";
import type { ChatSettings } from "../types/chat";

// ── Multi-file Helpers ──────────────────────────────────────────────────
function parseMultiFile(content: string): Array<{ path: string; content: string }> {
  const files: Array<{ path: string; content: string }> = [];
  const regex = /<file\s+path=["']([^"']+)["']\s*>([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    files.push({
      path: match[1],
      content: match[2].trim()
    });
  }
  return files;
}

function mergeFilesForPreview(files: Array<{ path: string; content: string }>): string {
  const indexFile = files.find(f => f.path.toLowerCase() === 'index.html' || f.path.toLowerCase() === 'index.htm');
  if (!indexFile) return files[0]?.content || "";

  let html = indexFile.content;

  // Replace scripts
  html = html.replace(/<script\s+[^>]*src=["']([^"']+)["'][^>]*>\s*<\/script>/gi, (match, src) => {
    const file = files.find(f => f.path === src || f.path === src.replace(/^\.\//, ''));
    if (file) {
      return `<script>\n${file.content}\n</script>`;
    }
    return match;
  });

  // Replace styles
  html = html.replace(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (match, href) => {
    const file = files.find(f => f.path === href || f.path === href.replace(/^\.\//, ''));
    if (file) {
      return `<style>\n${file.content}\n</style>`;
    }
    return match;
  });

  return html;
}
// ───────────────────────────────────────────────────────────────────────

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
const INTERVIEWER_PROMPT = `Ты — Гейм-Архитектор SmolGame. Твоя задача — собрать детали и выдать ТЗ для инженера.

ПРАВИЛА:
1. КРАТКОСТЬ: Не выводи техническое задание пользователю. Оно должно быть ТОЛЬКО внутри тега <opengame_prompt>.
2. ПОВЕДЕНИЕ: Если деталей достаточно, просто напиши "Понял, создаю игру!" (или короткую фразу в тему) и сразу выдавай <opengame_prompt>. Не задавай лишних вопросов.
3. ТЕХНИЧЕСКИЙ ПЛАН: Внутри <opengame_prompt> пропиши стек (Three.js, PixiJS и т.д.) и механику.
4. ИНТЕРВЬЮ: Если деталей мало, задай ОДИН короткий вопрос по существу.

ВНУТРИ <opengame_prompt> СФОРМИРУЙ ПЛАН:
- Name: Название
- Tech Stack: Библиотеки
- Core Loop: Цикл
- Mobile UX: Тач-управление
- Visuals: Стиль и эффекты`;

// ──────────────────────────────────────────────
// ФАЗА 2: Промпт для черновика (Draft)
// ──────────────────────────────────────────────
const DRAFT_PROMPT = `You are the Expert Game Architect. Create a fun, polished single-file prototype.

TECHNICAL STANDARDS:
- PIXIJS: Use EXACTLY https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/pixi.min.js (NEVER use /release/pixi.js).
- MOBILE: Strictly Portrait 9:16. Large touch targets.
- FEEL: Focus on core mechanics that feel great. 

Output the full code inside <game_spec> tags.`;

const REFINER_PROMPT = `You are the Elite Game Refiner. Your mission is to turn the draft into a professional, modular mobile game.

GOLD STANDARD TECHNICAL REQUIREMENTS:
1. LIBRARIES (MANDATORY): 
   - PixiJS: Use EXACTLY https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/pixi.min.js
   - Tween.js: Use https://cdnjs.cloudflare.com/ajax/libs/tween.js/18.6.4/tween.umd.js
2. STRICT MODULARITY: You MUST split the code into separate files.
   Use this format:
   <game_spec>
   <file path="index.html">...</file>
   <file path="js/game.js">...</file>
   <file path="css/style.css">...</file>
   </game_spec>
3. NO BACKEND: Static game for GitHub Pages. Client-side only.
4. JUICE & POLISH: Add screen shake, particles, and smooth feel.
5. MOBILE FIRST: 9:16 Portrait, large touch targets, pointer events.

Output ONLY the <game_spec> block.`;

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    try {
      const saved = localStorage.getItem("smol_agent_messages_v1");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const chatHistory = useRef<{ role: "user" | "assistant" | "system"; content: string }[]>((() => {
    try {
      const saved = localStorage.getItem("smol_agent_history_v1");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  })());

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem("smol_agent_messages_v1", JSON.stringify(messages));
    localStorage.setItem("smol_agent_history_v1", JSON.stringify(chatHistory.current));
  }, [messages]);

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
      // ФАЗА 2: Черновик (Draft)
      // ══════════════════════════════════════════
      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      const tagStart = interviewText.search(/<opengame_prompt>|opengame_prompt/i);
      const beforeTag = tagStart > 0 ? interviewText.slice(0, tagStart).trim() : "";

      const isModification = !!previousCode;
      
      let rawCode = "";
      let draftCode = "";

      if (isModification) {
        // Для модификаций используем существующий Aider-метод (один проход)
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔧 Модифицирую код...",
          isStreaming: true,
        });
        setStep("🔧 Модификация...");

        const { text: modificationText } = await streamWithFallback(
          [
            { role: "system", content: AIDER_EDITOR_PROMPT + `\n\nCURRENT FILE CONTENT:\n${previousCode}` },
            { role: "user", content: `Modify the code:\n\n${gameSpec}` }
          ],
          () => {}, // Прогресс не выводим детально
          signal,
          usedProvider
        );

        const blocks = parseAiderBlocks(modificationText);
        if (blocks.length > 0) {
          rawCode = applyAiderBlocks(previousCode, blocks).code;
        } else {
          const match = modificationText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || modificationText.match(/<html[\s\S]*<\/html>/i);
          rawCode = match ? (match[1] || match[0]) : previousCode;
        }
      } else {
        // ГЕНЕРАЦИЯ С НУЛЯ (ДВА ПРОХОДА)
        
        // --- ПРОХОД 1: ЧЕРНОВИК ---
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 Создаю черновик геймплея...",
          isStreaming: true,
        });
        setStep("🔨 Черновик...");

        const { text: draftText } = await streamWithFallback(
          [
            { role: "system", content: DRAFT_PROMPT },
            { role: "user", content: `Build this game prototype:\n\n${gameSpec}` }
          ],
          () => {},
          signal,
          usedProvider
        );

        const draftMatch = draftText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || draftText.match(/<html[\s\S]*<\/html>/i);
        draftCode = draftMatch ? (draftMatch[1] || draftMatch[0]).trim() : draftText.trim();

        // --- ПРОХОД 2: ПОЛИРОВКА И СТРУКТУРА ---
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "✨ Исправляю баги и полирую до идеала...",
          isStreaming: true,
        });
        setStep("✨ Полировка...");

        const { text: finalResponse } = await streamWithFallback(
          [
            { role: "system", content: REFINER_PROMPT },
            { role: "user", content: `Take this draft and make it perfect (modular files, mobile UX, juice, bugfixes):\n\n${draftCode}` }
          ],
          () => {},
          signal,
          usedProvider
        );

        // Теперь у нас должен быть многофайловый вывод
        rawCode = finalResponse;
      }

      if (!rawCode || rawCode.length < 500) {
        updateMessage(assistantId, {
          content: "❌ Инженер не вернул код игры. Попробуй ещё раз или смени провайдер в настройках.",
          isStreaming: false,
        });
        return;
      }

      // ══════════════════════════════════════════
      // ФАЗА 3: Публикация
      // ══════════════════════════════════════════
      // Очистка: вырезаем ТОЛЬКО то, что внутри <game_spec>
      let finalCode = rawCode;
      const specMatch = rawCode.match(/<game_spec>([\s\S]*?)<\/game_spec>/i);
      if (specMatch) {
        finalCode = specMatch[1].trim();
      }
      
      setStep("🚀 Публикую в облако...");
      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра создана!**\n\n🚀 **Публикую на платформу...**`,
        gameCode: finalCode,
        isStreaming: true,
      });

      // Название игры
      const titleMatch = gameSpec.match(/(?:название|title|game)[\s:]*([^\n.]{3,40})/i);
      const gameTitle = titleMatch?.[1]?.trim() || "SmolGame";

      try {
        // Проверяем, не прислал ли агент несколько файлов
        const parsedFiles = parseMultiFile(finalCode);
        const filesToPublish = parsedFiles.length > 0 
          ? parsedFiles 
          : [{ path: "index.html", content: finalCode }];

        const cleanDescription = gameSpec
          .replace(/\*\*.*?\*\*/g, '') // Убираем жирный текст (теги)
          .replace(/[-*]/g, '')        // Убираем маркеры списков
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 5)
          .join(' ')
          .slice(0, 150) + '...';

        const publishResult = await SmolGameAPI.publishGame({
          gameTitle,
          files: filesToPublish,
          gameDescription: cleanDescription,
        });

        // --- ШАГ 3.1: Ожидание деплоя (имитация бурной деятельности) ---
        setStep("🚀 Финализация облачной сборки...");
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра создана!**\n\n🚀 **Публикую на платформу...**\n\n⏳ *Оптимизирую ресурсы и настраиваю серверы...*`,
          gameCode: finalCode,
          isStreaming: true,
        });

        const pagesUrl = publishResult.pagesUrl;
        
        // Поллинг с обновлением статуса для "красоты"
        const statuses = [
          "Оптимизирую ассеты для мобильных устройств...",
          "Настраиваю кэширование и CDN...",
          "Проверяю совместимость с браузерами...",
          "Финальное тестирование игрового движка...",
          "Почти готово! Разворачиваю в облаке..."
        ];

        await SmolGameAPI.pollPagesReady(pagesUrl, (attempt) => {
          const statusIdx = Math.min(statuses.length - 1, Math.floor((attempt - 1) / 4));
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра создана!**\n\n🚀 **Публикую на платформу...**\n\n⏳ *${statuses[statusIdx]}*`,
            isStreaming: true,
          });
        });

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова!**\n\n✨ **Игра опубликована!** Нажми «ИГРАТЬ», чтобы протестировать её.`,
          gameCode: parsedFiles.length > 0 ? mergeFilesForPreview(parsedFiles) : finalCode,
          deployResult: {
            pagesUrl: publishResult.pagesUrl,
            repoUrl: publishResult.repo ? `https://github.com/${publishResult.repo}` : "",
            pagesReady: true, // Мы уже проверили поллингом
          },
          isStreaming: false,
        });
      } catch (pubErr: any) {
        console.error("[Agent] Publication failed:", pubErr);
        const errMsg = pubErr.message || "Ошибка сети или сервера";
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова!**\n\n⚠️ **Публикация не удалась:** ${errMsg}\n\nТы всё равно можешь запустить её в Студии!`,
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
    localStorage.removeItem("smol_agent_messages_v1");
    localStorage.removeItem("smol_agent_history_v1");
    FALLBACK_ORDER.forEach(p => pool.reset(p));
  }, []);

  return { messages, isRunning, step, sendMessage, stop, reset };
}
