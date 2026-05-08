/**
 * useGameAgent — Умный агент на базе Vercel AI SDK
 * Полная ротация провайдеров + таймауты
 */

import { useState, useRef, useCallback } from "react";
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { SmolGameAPI } from "../lib/smolgame-api";
import type { ChatSettings, APIProvider } from "../types/chat";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: number;
  isStreaming?: boolean;
  gameCode?: string;
  pipelineResult?: any;
  deployResult?: any;
  toolCalls?: AgentToolCall[];
}

export interface AgentToolCall {
  name: string;
  status: "running" | "done" | "error";
  input?: any;
  output?: string;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

// Порядок перебора провайдеров (Оркестр)
const PROVIDER_ORDER: APIProvider[] = [
  "groq", "gemini", "together", "openrouter", "deepseek", "sambanova", "huggingface", "custom"
];

const DEFAULT_MODELS: Record<string, string> = {
  groq: "llama-3.3-70b-versatile",
  gemini: "gemini-2.0-flash",
  together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
  openrouter: "google/gemini-2.0-flash-001",
  deepseek: "deepseek-chat",
  sambanova: "Meta-Llama-3.3-70B-Instruct",
  huggingface: "mistralai/Mistral-7B-Instruct-v0.3",
};

const BASE_URLS: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/",
  together: "https://api.together.xyz/v1",
  openrouter: "https://openrouter.ai/api/v1",
  deepseek: "https://api.deepseek.com/v1",
  sambanova: "https://api.sambanova.ai/v1",
  huggingface: "https://api-inference.huggingface.co/v1/",
};

interface ProviderConfig {
  id: APIProvider;
  model: LanguageModel;
  name: string;
}

type LanguageModel = ReturnType<ReturnType<typeof createOpenAI>>;

function buildProviderList(settings: ChatSettings): ProviderConfig[] {
  const list: ProviderConfig[] = [];

  for (const p of PROVIDER_ORDER) {
    const key = settings.keys[p];
    if (!key || typeof key !== "string" || !key.trim()) continue;

    const baseURL = p === "custom" ? settings.customBaseUrl : BASE_URLS[p];
    if (!baseURL) continue;

    // compatibility: "strict" — принудительно использует /chat/completions
    // вместо нового /responses API, который не поддерживают большинство провайдеров
    const client = createOpenAI({
      baseURL,
      apiKey: key.trim(),
      compatibility: "strict",
    });

    const modelId = (settings.models?.[p] as string | undefined) || DEFAULT_MODELS[p] || "gpt-4o-mini";
    list.push({ id: p, model: client(modelId), name: `${p} (${modelId.split("/").pop()})` });
  }

  return list;
}

const REQUEST_TIMEOUT_MS = 90_000; // 90 секунд на провайдера

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((msg: Omit<AgentMessage, "id" | "timestamp">) => {
    const full: AgentMessage = { ...msg, id: makeId(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<AgentMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const sendMessage = useCallback(async (userText: string) => {
    if (isRunning) return;

    addMessage({ role: "user", content: userText });
    const assistantId = addMessage({ role: "assistant", content: "🤔 Думаю...", isStreaming: true });

    setIsRunning(true);
    abortRef.current = new AbortController();

    const providers = buildProviderList(settings);
    if (providers.length === 0) {
      updateMessage(assistantId, {
        content: "❌ Нет доступных API ключей. Открой настройки (≡) и добавь хотя бы один ключ.",
        isStreaming: false
      });
      setIsRunning(false);
      return;
    }

    // Собираем историю для контекста
    const history = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const toolCalls: AgentToolCall[] = [];
    let lastError = "";

    // ОРКЕСТР: перебираем провайдеров по очереди
    for (const providerConfig of providers) {
      if (abortRef.current?.signal.aborted) break;

      setStep(`🔄 Подключаю ${providerConfig.name}...`);
      updateMessage(assistantId, { content: `🔄 Подключаю ${providerConfig.name}...`, isStreaming: true });

      // Таймаут для каждого провайдера
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);

      try {
        const result = await generateText({
          model: providerConfig.model,
          maxSteps: 5,
          abortSignal: timeoutController.signal,
          system: `Ты — SmolGame Agent, специалист по созданию веб-игр для мобильных телефонов.

Твоя задача: пообщаться с пользователем, понять что он хочет сделать, и когда у тебя есть достаточно информации (жанр + механика + стиль) — создать полноценную игру.

ПРАВИЛА:
- Общайся по-русски, дружелюбно и энергично.
- Задавай по ОДНОМУ вопросу за раз, чтобы собрать детали.
- Когда деталей достаточно — вызови инструмент createGame.
- После создания игры — вызови инструмент publishGame.
- Если пользователь просит переделать — вызови createGame снова.`,
          messages: [
            ...history,
            { role: "user", content: userText }
          ],
          tools: {
            createGame: tool({
              description: "Создаёт полноценную HTML-игру. Вызывай когда собрал достаточно информации о жанре, механике и стиле.",
              parameters: z.object({
                gameSpec: z.string().describe("Подробное описание игры: жанр, механика, визуальный стиль, управление для мобильных"),
                gameCode: z.string().describe("ПОЛНЫЙ рабочий HTML+CSS+JS код игры в одном файле. Код должен быть больше 3000 символов. БЕЗ СКЕЛЕТОВ И ПЛЕЙСХОЛДЕРОВ."),
              }),
              execute: async ({ gameSpec, gameCode }) => {
                setStep("🎮 Проверяю качество кода...");
                updateMessage(assistantId, { content: "🎮 Оцениваю качество игры...", isStreaming: true });
                toolCalls.push({ name: "createGame", status: "running", input: { gameSpec } });
                updateMessage(assistantId, { toolCalls: [...toolCalls] });
                try {
                  const pipeline = await runGamePipeline("agent-game", gameCode);
                  const score = pipeline.finalScore;
                  toolCalls[toolCalls.length - 1] = { name: "createGame", status: "done", output: `Качество: ${score}/100` };
                  updateMessage(assistantId, {
                    content: `✅ **Игра создана! (${score}/100)**\n\nТы можешь запустить её или скопировать код.`,
                    gameCode, pipelineResult: pipeline, toolCalls: [...toolCalls], isStreaming: true
                  });
                  return { success: true, score, gameCode, message: `Игра создана. Качество: ${score}/100` };
                } catch (e: any) {
                  toolCalls[toolCalls.length - 1] = { name: "createGame", status: "error", output: e.message };
                  return { success: false, message: e.message };
                }
              },
            }),

            publishGame: tool({
              description: "Публикует игру на GitHub Pages. Вызывай после createGame если игра прошла проверку.",
              parameters: z.object({
                gameTitle: z.string().describe("Название игры"),
                gameCode: z.string().describe("Полный HTML код игры"),
              }),
              execute: async ({ gameTitle, gameCode }) => {
                setStep("🚀 Публикую на GitHub...");
                toolCalls.push({ name: "publishGame", status: "running" });
                updateMessage(assistantId, { toolCalls: [...toolCalls] });
                try {
                  const result = await SmolGameAPI.publishGame({
                    gameTitle,
                    files: [{ path: "index.html", content: gameCode }],
                    gameDescription: "Generated by SmolGame AI Agent",
                  });
                  if (result.ok) {
                    toolCalls[toolCalls.length - 1] = { name: "publishGame", status: "done", output: result.pagesUrl };
                    updateMessage(assistantId, {
                      deployResult: { pagesUrl: result.pagesUrl, repoUrl: `https://github.com/${result.repo}`, pagesReady: result.pagesReady },
                      toolCalls: [...toolCalls],
                    });
                    return { success: true, pagesUrl: result.pagesUrl, repo: result.repo };
                  } else {
                    toolCalls[toolCalls.length - 1] = { name: "publishGame", status: "error", output: result.error };
                    return { success: false, message: result.error || "Ошибка публикации" };
                  }
                } catch (e: any) {
                  toolCalls[toolCalls.length - 1] = { name: "publishGame", status: "error", output: e.message };
                  return { success: false, message: e.message };
                }
              },
            }),

            editGame: tool({
              description: "Загружает код игры из GitHub и вносит изменения. Используй когда пользователь хочет изменить существующую игру.",
              parameters: z.object({
                repoUrl: z.string().describe("URL репозитория GitHub"),
                editInstructions: z.string().describe("Что нужно изменить"),
                updatedCode: z.string().describe("ПОЛНЫЙ обновлённый HTML код игры"),
              }),
              execute: async ({ repoUrl, editInstructions, updatedCode }) => {
                setStep("✏️ Применяю правки...");
                toolCalls.push({ name: "editGame", status: "running", input: { repoUrl } });
                updateMessage(assistantId, { toolCalls: [...toolCalls] });
                try {
                  const repo = repoUrl.replace("https://github.com/", "").split("/").slice(0, 2).join("/");
                  const fileData = await SmolGameAPI.getGameFile(repo);
                  const updateResult = await SmolGameAPI.updateGameFile({
                    repo, path: fileData.path, content: updatedCode, sha: fileData.sha,
                    message: `Edit via SmolGame Agent: ${editInstructions.slice(0, 60)}`,
                  });
                  if (updateResult.ok) {
                    toolCalls[toolCalls.length - 1] = { name: "editGame", status: "done", output: `Правки в ${repo}` };
                    updateMessage(assistantId, { gameCode: updatedCode, toolCalls: [...toolCalls] });
                    return { success: true, message: `Правки сохранены в ${repo}` };
                  } else {
                    toolCalls[toolCalls.length - 1] = { name: "editGame", status: "error", output: "Ошибка сохранения" };
                    return { success: false, message: "Не удалось сохранить правки" };
                  }
                } catch (e: any) {
                  toolCalls[toolCalls.length - 1] = { name: "editGame", status: "error", output: e.message };
                  return { success: false, message: e.message };
                }
              },
            }),
          },
        });

        clearTimeout(timeoutId);

        // Успех — обновляем сообщение и выходим из цикла
        const finalText = result.text || "";
        updateMessage(assistantId, {
          content: finalText || "Готово!",
          isStreaming: false,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        });
        break; // Успешно получили ответ — выходим

      } catch (e: any) {
        clearTimeout(timeoutId);
        lastError = e.message || "Неизвестная ошибка";
        const isTimeout = e.name === "AbortError" || lastError.includes("aborted");
        const isRateLimit = lastError.includes("429") || lastError.includes("rate limit");

        console.warn(`[Agent] Provider ${providerConfig.name} failed:`, lastError);
        setStep(isTimeout
          ? `⏱️ Таймаут ${providerConfig.name}. Пробую следующий...`
          : isRateLimit
            ? `⚡ Лимит ${providerConfig.name}. Пробую следующий...`
            : `❌ ${providerConfig.name} недоступен. Пробую следующий...`
        );
        updateMessage(assistantId, {
          content: `🔄 ${providerConfig.name} не ответил, переключаюсь...`,
          isStreaming: true,
        });

        // Если rate limit — подождём 3 секунды
        if (isRateLimit) {
          await new Promise(r => setTimeout(r, 3000));
        }
        // Продолжаем к следующему провайдеру
      }
    }

    // Если все провайдеры провалились
    const finalMsg = messages.find(m => m.id === assistantId);
    if (finalMsg?.isStreaming) {
      updateMessage(assistantId, {
        content: `❌ Все провайдеры недоступны. Последняя ошибка: ${lastError}\n\nПроверь ключи в настройках (≡).`,
        isStreaming: false,
      });
    }

    setIsRunning(false);
    setStep("");
  }, [isRunning, messages, settings, addMessage, updateMessage]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStep("");
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, isRunning, step, sendMessage, stop, reset };
}
