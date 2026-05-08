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
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { GameTestingFrameworkPro } from "../lib/core/gameTestingFrameworkPro";
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
const DRAFT_PROMPT = `You are the SmolGame DRAFT ENGINEER. Build a core gameplay prototype in ONE SINGLE HTML file.
Focus on:
1. Core mechanics (collision, movement, scoring, game loop).
2. Basic visuals and layout.
3. Mobile-first (Portrait 9:16 aspect ratio).
Output the full standalone HTML code inside <game_spec> tags. No multiple files yet.`;

// ──────────────────────────────────────────────
// ФАЗА 3: Промпт для полировки (Refiner)
// ──────────────────────────────────────────────
const REFINER_PROMPT = `You are the SmolGame ELITE REFINER. Take the provided draft and turn it into a premium mobile game.
STRICT COMMANDS:
1. FIX BUGS: Audit the code for logical errors, memory leaks, and performance.
2. POLISH (JUICE): Add screen shake, particles, smooth tweens, score popups, and high-quality effects.
3. PHONE-FIRST (MOBILE UX): 
   * **Touch Targets**: All interactive elements MUST be at least 44x44px.
   * **Pointer Events**: Use 'pointerdown' for zero-lag interaction. Avoid 'click'.
   * **Responsive Scaling**: Use viewport units (vw/vh) and ensure the game looks perfect in 9:16 Portrait mode.
   * **UI Layout**: Position controls at the bottom of the screen for easy thumb access.
4. MODULAR STRUCTURE: You MUST split the code into multiple files using the <file path="filename"> tags.
   Structure:
   - index.html (minimal)
   - js/game.js (logic)
   - css/style.css (styling)
   Use relative paths for scripts/links.

Output Format:
<thought>Analysis of the draft and improvement plan</thought>
<game_spec>
<file path="index.html">...</file>
<file path="js/game.js">...</file>
...
</game_spec>`;

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

        // --- ШАГ 3.1: Тестирование в реальном времени (Runtime Test) ---
        setStep("🕵️ Тестирую запуск игры...");
        const tester = new GameTestingFrameworkPro(assistantId, rawCode);
        const testReport = await tester.runAllTests();
        
        console.log("[Agent] Runtime Test Report:", testReport);

        // --- ШАГ 3.2: AI-Критик (Вердикт) ---
        setStep("⚖️ Финальная проверка качества...");
        
        const criticPrompt = `You are a brutal game critic and technical lead.
Review this game code:
${rawCode.slice(0, 5000)}

Technical Test Report:
${testReport.summary}

Regex Validation Score: ${score}/100

CRITICAL RULES:
1. If the Technical Test Report says 'NOT PLAYABLE' or has 'JS Errors' > 0, the score is 0.
2. If it's a skeletal template with "// implement logic here", the score is 0.
3. Check if the game matches the prompt: "${gameSpec}"

Response format:
SCORE: [0-100]
CRITIQUE: [Your brutal feedback]
NEXT_STEPS: [What to fix exactly]`;

        let criticResponse = "";
        await streamWithFallback(
          [{ role: "user", content: criticPrompt }],
          (_c, full) => { criticResponse = full; },
          signal,
          usedProvider
        );
        
        const criticScoreMatch = criticResponse.match(/SCORE:\s*(\d+)/);
        const criticScore = parseInt(criticScoreMatch?.[1] || "0");
        const critique = criticResponse.split("CRITIQUE:")[1]?.split("NEXT_STEPS:")[0]?.trim() || "";
        const nextSteps = criticResponse.split("NEXT_STEPS:")[1]?.trim() || "";

        const finalScore = Math.min(score, criticScore);
        pipeline.finalScore = finalScore;
        pipeline.critique = critique;
        pipeline.nextSteps = [nextSteps];
        score = finalScore;
        finalCode = rawCode;

        // --- ШАГ 3: Авто-исправление (на основе критики) ---
        let attempts = 0;
        const maxAttempts = 2;

        while (score < 80 && attempts < maxAttempts) {
          attempts++;
          setStep(`🔧 Модульный ремонт (попытка ${attempts}/${maxAttempts})...`);
          
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `⚠️ **Качество: ${score}/100**. Исправляю только проблемные места (${attempts}/${maxAttempts})...`,
            isStreaming: true,
          });

          const fixMsgs = [
            { 
              role: "system" as const, 
              content: AIDER_EDITOR_PROMPT + `\n\nCURRENT FILE CONTENT:\n${finalCode}\n\nFIX THESE ISSUES:\n${pipeline.nextSteps.join("\n")}` 
            },
            { role: "user" as const, content: `Produce SEARCH/REPLACE blocks to fix the issues mentioned above. Do not rewrite the whole file.` },
          ];

          const { text: fixResponse } = await streamWithFallback(
            fixMsgs,
            (_chunk, full) => {
              updateMessage(assistantId, {
                content: (beforeTag ? beforeTag + "\n\n" : "") + `🔧 Применяю исправления... (${full.length} симв.)`,
                isStreaming: true,
              });
            },
            signal,
            usedProvider
          );

          // Пробуем применить блоки
          const blocks = parseAiderBlocks(fixResponse);
          if (blocks.length > 0) {
            const patchResult = applyAiderBlocks(finalCode, blocks);
            if (patchResult.appliedCount > 0) {
              finalCode = patchResult.code;
              console.log(`[Agent] Applied ${patchResult.appliedCount} blocks successfully.`);
            } else {
              console.warn("[Agent] Failed to apply any SEARCH/REPLACE blocks. Falling back to full rewrite...");
              // Fallback to full rewrite if diff failed
              const fallbackMsgs = [
                { role: "system", content: ENGINEER_PROMPT + `\n\nEXISTING CODE:\n${finalCode}\n\nISSUE:\n${pipeline.nextSteps.join("\n")}` },
                { role: "user", content: "SEARCH/REPLACE failed. Return the COMPLETE fixed HTML now." }
              ];
              const { text: fullFix } = await streamWithFallback(fallbackMsgs, () => {}, signal, usedProvider);
              const fullMatch = fullFix.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || fullFix.match(/<html[\s\S]*<\/html>/i);
              if (fullMatch) finalCode = fullMatch[1]?.trim() || fullMatch[0]?.trim();
            }
          } else {
            // Если блоков вообще нет, значит он прислал полный код (не послушался)
            const fullMatch = fixResponse.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || fixResponse.match(/<html[\s\S]*<\/html>/i);
            if (fullMatch) finalCode = fullMatch[1]?.trim() || fullMatch[0]?.trim();
          }

          // Перепроверяем финальный вариант
          pipeline = await runGamePipeline("agent-game", finalCode);
          score = pipeline.finalScore;
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
      
      setStep("🚀 Публикую в облако...");
      updateMessage(assistantId, {
        content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n🚀 **Публикую на платформу...**`,
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

        const publishResult = await SmolGameAPI.publishGame({
          gameTitle,
          files: filesToPublish,
          gameDescription: `Generated by SmolGame Agent: ${gameSpec.slice(0, 100)}`,
        });

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n✨ **Игра опубликована!** Нажми «ИГРАТЬ», чтобы протестировать её.`,
          gameCode: parsedFiles.length > 0 ? mergeFilesForPreview(parsedFiles) : finalCode,
          deployResult: {
            pagesUrl: publishResult.pagesUrl,
            repoUrl: publishResult.repo ? `https://github.com/${publishResult.repo}` : "",
            pagesReady: publishResult.pagesReady,
          },
          isStreaming: false,
        });
      } catch (pubErr: any) {
        console.error("[Agent] Publication failed:", pubErr);
        const errMsg = pubErr.message || "Ошибка сети или сервера";
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Игра готова! (Качество: ${score}/100)**\n\n⚠️ **Публикация не удалась:** ${errMsg}\n\nТы всё равно можешь запустить её в Студии!`,
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
