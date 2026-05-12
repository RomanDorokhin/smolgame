import { useState, useCallback, useRef } from "react";
import { SmolGameAPI } from "@/lib/smolgame-api";
import type { ChatSettings } from "@/types/chat";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  gameCode?: string;
  timestamp: number;
  isStreaming?: boolean;
}

const makeId = () => Math.random().toString(36).substring(2, 9);

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");

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
    const assistantId = addMessage({ role: "assistant", content: "🚀 Инициализация OpenGame...", isStreaming: true });
    
    setIsRunning(true);
    setStep("Генерация через OpenGame...");

    try {
      const providers = Object.entries(settings.keys)
        .filter(([_, key]) => !!key)
        .map(([p]) => p);

      if (providers.length === 0) {
        updateMessage(assistantId, {
          content: "❌ Нет API ключей. Откройте настройки и добавьте хотя бы один ключ.",
          isStreaming: false
        });
        return;
      }

      const reader = await SmolGameAPI.generateWithOpenGame({
        prompt: userText,
        keys: settings.keys as Record<string, string>,
        providers
      });

      const decoder = new TextDecoder();
      let fullOutput = "";
      let gameCode = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        fullOutput += chunk;

        // Если пришел финальный результат
        if (fullOutput.includes("===OPEN_GAME_RESULT===")) {
          const parts = fullOutput.split("===OPEN_GAME_RESULT===");
          const logs = parts[0];
          gameCode = parts[1]?.trim() || "";
          
          updateMessage(assistantId, {
            content: "✅ **Игра успешно создана через OpenGame!**\n\n🛠 **Логи процесса:**\n```\n" + logs.slice(-500) + "\n```",
            gameCode,
            isStreaming: false
          });
        } else {
          // Выводим только последние 1000 символов логов
          updateMessage(assistantId, {
            content: "🔨 **OpenGame работает...**\n\n```\n" + fullOutput.slice(-1000) + "\n```",
            isStreaming: true
          });
        }
      }

      if (!gameCode) {
        updateMessage(assistantId, {
          content: "❌ Ошибка: OpenGame завершился, но код игры не был получен.\n\n**Последние логи:**\n```\n" + fullOutput.slice(-1000) + "\n```",
          isStreaming: false
        });
      }

    } catch (e: any) {
      updateMessage(assistantId, {
        content: `❌ Ошибка: ${e.message}`,
        isStreaming: false
      });
    } finally {
      setIsRunning(false);
      setStep("");
    }
  }, [isRunning, settings, addMessage, updateMessage]);

  const stop = () => {
    setIsRunning(false);
    setStep("");
  };

  const reset = () => {
    setMessages([]);
  };

  return { messages, isRunning, step, sendMessage, stop, reset };
}



