/**
 * useGameAgent — Умный агент на базе Vercel AI SDK
 * Использует многошаговое мышление и инструменты вместо жестких промптов
 */

import { useState, useRef, useCallback } from "react";
import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { SmolGameAPI } from "../lib/smolgame-api";
import type { ChatSettings } from "../types/chat";

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

function buildProvider(settings: ChatSettings) {
  // Найдем первый доступный ключ
  const order = ["openrouter", "groq", "gemini", "together", "deepseek", "huggingface", "custom"];
  for (const p of order) {
    const key = settings.keys[p as keyof typeof settings.keys];
    if (key && typeof key === "string" && key.trim().length > 0) {
      if (p === "openrouter") {
        return createOpenAI({ baseURL: "https://openrouter.ai/api/v1", apiKey: key });
      }
      if (p === "groq") {
        return createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey: key });
      }
      if (p === "together") {
        return createOpenAI({ baseURL: "https://api.together.xyz/v1", apiKey: key });
      }
      if (p === "deepseek") {
        return createOpenAI({ baseURL: "https://api.deepseek.com/v1", apiKey: key });
      }
      if (p === "gemini") {
        return createOpenAI({ baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/", apiKey: key });
      }
      if (p === "huggingface") {
        return createOpenAI({ baseURL: "https://api-inference.huggingface.co/v1/", apiKey: key });
      }
      if (p === "custom" && settings.customBaseUrl) {
        return createOpenAI({ baseURL: settings.customBaseUrl, apiKey: key });
      }
    }
  }
  return null;
}

function buildModelId(settings: ChatSettings, provider: ReturnType<typeof buildProvider>) {
  const order = ["openrouter", "groq", "gemini", "together", "deepseek", "huggingface", "custom"];
  for (const p of order) {
    const key = settings.keys[p as keyof typeof settings.keys];
    if (key && typeof key === "string" && key.trim().length > 0) {
      return settings.models?.[p as keyof typeof settings.models] || getDefaultModel(p);
    }
  }
  return "gpt-4o-mini";
}

function getDefaultModel(provider: string): string {
  const defaults: Record<string, string> = {
    openrouter: "google/gemini-2.0-flash-001",
    groq: "llama-3.3-70b-versatile",
    gemini: "gemini-2.0-flash",
    together: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    deepseek: "deepseek-chat",
    huggingface: "mistralai/Mistral-7B-Instruct-v0.3",
  };
  return defaults[provider] || "gpt-4o-mini";
}

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

    const provider = buildProvider(settings);
    if (!provider) {
      updateMessage(assistantId, {
        content: "❌ Нет доступных API ключей. Добавь ключи в настройках (OpenRouter, Groq и т.д.).",
        isStreaming: false
      });
      setIsRunning(false);
      return;
    }

    const modelId = buildModelId(settings, provider);
    const model = provider(modelId);

    // Собираем историю для контекста
    const history = messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map(m => ({ role: m.role as "user" | "assistant", content: m.content }));

    const toolCalls: AgentToolCall[] = [];

    try {
      const result = await generateText({
        model,
        maxSteps: 5,
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
          // Инструмент: Создать игру
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
                  gameCode,
                  pipelineResult: pipeline,
                  toolCalls: [...toolCalls],
                  isStreaming: true // Still streaming, publishGame may follow
                });

                return { success: true, score, gameCode, message: `Игра создана. Качество: ${score}/100` };
              } catch (e: any) {
                toolCalls[toolCalls.length - 1] = { name: "createGame", status: "error", output: e.message };
                return { success: false, message: e.message };
              }
            },
          }),

          // Инструмент: Опубликовать игру
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
                    deployResult: {
                      pagesUrl: result.pagesUrl,
                      repoUrl: `https://github.com/${result.repo}`,
                      pagesReady: result.pagesReady
                    },
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
        },
      });

      // Финальный текст от агента
      const finalText = result.text || "";
      updateMessage(assistantId, {
        content: finalText || messages.find(m => m.id === assistantId)?.content || "Готово!",
        isStreaming: false,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      });

    } catch (e: any) {
      updateMessage(assistantId, {
        content: `❌ Ошибка: ${e.message}`,
        isStreaming: false,
      });
    } finally {
      setIsRunning(false);
      setStep("");
    }
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
