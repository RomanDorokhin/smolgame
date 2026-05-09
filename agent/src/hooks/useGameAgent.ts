import { useState, useCallback, useRef, useEffect } from "react";
import { generateStream } from "@/lib/llm-api";
import { SmolGameAPI } from "@/lib/smolgame-api";
import type { APIProvider, ChatSettings } from "@/types/chat";
import { pool } from "@/lib/llm-api";

// ──────────────────────────────────────────────
// ТИПЫ
// ──────────────────────────────────────────────
export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  gameCode?: string;
  timestamp: number;
  isStreaming?: boolean;
  deployState?: {
    phase: "idle" | "deploying" | "waiting_pages" | "ready" | "error";
    status?: string;
    pagesUrl?: string;
    repoUrl?: string;
    attempt?: number;
    maxAttempts?: number;
    error?: string;
  };
}

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "openrouter", "together", "deepseek", "huggingface"];

const DEFAULT_MODELS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile"],
  gemini: ["gemini-2.0-flash"],
  openrouter: ["google/gemini-2.0-flash-001"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  deepseek: ["deepseek-chat"],
  huggingface: ["meta-llama/Llama-3.2-11B-Vision-Instruct"],
};

const makeId = () => Math.random().toString(36).substring(2, 9);

// ──────────────────────────────────────────────
// ПРОМПТЫ
// ──────────────────────────────────────────────

// ФАЗА 1: Интервьюер (Архитектор)
const INTERVIEWER_PROMPT = `You are the Expert Game Architect. Your goal is to gather requirements for a high-quality mobile web game.

GUIDELINES:
1. UNLIMITED POTENTIAL: You can create anything from simple 2D to advanced 3D experiences.
2. TECHNOLOGY: Use any modern web technology (HTML5, JavaScript, WebGL, Three.js, Phaser, etc.).
3. Ask ONLY 1-2 most important questions at a time.
4. Once you have a clear vision, output the game specification inside <opengame_prompt> tags.

The <opengame_prompt> must include:
- MANDATORY DIRECTIVE: "СДЕЛАЙ ИГРУ МИРОВОГО УРОВНЯ ОТ НАЧАЛА И ДО КОНЦА"
- Name: Название
- Tech Stack: Recommended libraries (Three.js for 3D, PixiJS for 2D, etc.)
- Core Loop: Цикл
- Visuals: Style and effects`;

   <game_spec>
   <file path="index.html">...</file>
   <file path="js/game.js">...</file>
   <file path="css/style.css">...</file>
   </game_spec>

Deliver excellence. Output ONLY the <game_spec> block.`;

const AIDER_EDITOR_PROMPT = `You are the Senior Game Developer. Modify the existing game code based on user requests.

Output the changes using <game_spec> tags with full file contents.`;

// ──────────────────────────────────────────────
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ──────────────────────────────────────────────

function parseMultiFile(text: string): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  const fileRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/gi;
  let match;
  while ((match = fileRegex.exec(text)) !== null) {
    files.push({ path: match[1], content: match[2].trim() });
  }
  return files;
}

function mergeFilesForPreview(files: { path: string; content: string }[]): string {
  const htmlFile = files.find(f => f.path.endsWith(".html"));
  if (!htmlFile) return files[0]?.content || "";
  
  let merged = htmlFile.content;
  files.forEach(f => {
    if (f.path.endsWith(".js")) {
      const fileName = f.path.split('/').pop() || f.path;
      const scriptTag = new RegExp(`<script[^>]*src=["'][^"']*${fileName}["'][^>]*><\\/script>`, 'i');
      merged = merged.replace(scriptTag, `<script>\n${f.content}\n</script>`);
    } else if (f.path.endsWith(".css")) {
      const fileName = f.path.split('/').pop() || f.path;
      const linkTag = new RegExp(`<link[^>]*href=["'][^"']*${fileName}["'][^>]*>`, 'i');
      merged = merged.replace(linkTag, `<style>\n${f.content}\n</style>`);
    }
  });
  return merged;
}

function parseAiderBlocks(text: string): { search: string; replace: string }[] {
  const blocks: { search: string; replace: string }[] = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({ search: match[1], replace: match[2] });
  }
  return blocks;
}

function applyAiderBlocks(code: string, blocks: { search: string; replace: string }[]): { code: string; applied: number } {
  let result = code;
  let applied = 0;
  for (const block of blocks) {
    if (result.includes(block.search)) {
      result = result.replace(block.search, block.replace);
      applied++;
    }
  }
  return { code: result, applied };
}

// ──────────────────────────────────────────────
// HOOK
// ──────────────────────────────────────────────

export function useGameAgent(settings: ChatSettings) {
  const [messages, setMessages] = useState<AgentMessage[]>(() => {
    try {
      const saved = localStorage.getItem("smol_agent_messages_v1");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const [targetRepo, setTargetRepo] = useState<string | null>(null);
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

    const ordered = preferredProvider && active.includes(preferredProvider as APIProvider)
      ? [preferredProvider as APIProvider, ...active.filter(p => p !== preferredProvider)]
      : active;

    let lastError = "";
    for (let i = 0; i < ordered.length; i++) {
      const providerId = ordered[i];
      if (signal.aborted) throw new Error("Cancelled");

      const status = pool.getStatus(providerId);
      if (status.state === "OPEN") continue;

      const apiKey = settings.keys[providerId as keyof typeof settings.keys] as string;
      const model = (settings.models?.[providerId as keyof typeof settings.models] as string | undefined)
        || DEFAULT_MODELS[providerId]?.[0] || "gpt-3.5-turbo";

      try {
        if (i > 0) setStep(`🔄 Переключаюсь на ${providerId.toUpperCase()}...`);

        let fullText = "";
        const stream = generateStream(msgs, { provider: providerId, apiKey, model }, signal);
        
        for await (const chunk of stream) {
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
        if (i === ordered.length - 1) break;
      }
    }
    throw new Error(`All providers failed. Last: ${lastError}`);
  }, [settings, getActiveProviders]);

  const sendMessage = useCallback(async (userText: string, repoToUpdate?: string) => {
    if (isRunning) return;

    if (repoToUpdate) setTargetRepo(repoToUpdate);

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
      setStep("💬 Думаю...");
      const interviewMsgs = [
        { role: "system" as const, content: INTERVIEWER_PROMPT },
        ...chatHistory.current.slice(-15),
      ];

      const stripPromptTag = (text: string) =>
        text
          .replace(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/gi, "")
          .replace(/<\/?opengame_prompt>/gi, "")
          .replace(/opengame_prompt[\s\S]*/i, "")
          .trim();

      const { text: interviewText, provider: usedProvider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;
          const hasTag = /<opengame_prompt>/i.test(full) || /opengame_prompt/i.test(full);
          const visible = stripPromptTag(full);
          updateMessage(assistantId, {
            content: hasTag ? (visible || "🚀 ТЗ собрано! Подключаю инженера...") : (visible || "🤔 ..."),
            isStreaming: true,
          });
        },
        signal
      );

      chatHistory.current.push({ role: "assistant", content: interviewText });

      const promptMatch =
        interviewText.match(/<opengame_prompt>([\s\S]*?)<\/opengame_prompt>/i) ||
        interviewText.match(/<opengame_prompt>([\s\S]*?)$/i) ||
        interviewText.match(/opengame_prompt\s*([\s\S]+)/i);

      const isDetailedRequest = userText.length > 100 && (userText.includes("создай") || userText.includes("игру"));

      if (!promptMatch && !isDetailedRequest) {
        const visible = stripPromptTag(interviewText) || interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible, isStreaming: false });
        return;
      }

      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      const tagStart = interviewText.search(/<opengame_prompt>|opengame_prompt/i);
      const beforeTag = tagStart > 0 ? interviewText.slice(0, tagStart).trim() : "";
      const isModification = !!previousCode;
      
      let rawCode = "";

      if (isModification) {
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
          () => {},
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
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 Передаю задачу движку OpenGame... Запускаю изолированную песочницу...",
          isStreaming: true,
        });
        setStep("🚀 Запуск OpenGame...");

        try {
          // Получаем настройки юзера (ключи и порядок провайдеров)
          const activeProviders = getActiveProviders();
          
          const reader = await SmolGameAPI.generateWithOpenGame({
            prompt: gameSpec,
            keys: settings.keys as Record<string, string>,
            providers: activeProviders
          });

          const decoder = new TextDecoder();
          let fullConsole = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (signal.aborted) break;
            
            const chunk = decoder.decode(value, { stream: true });
            
            // Проверяем, не пришел ли финальный результат
            if (chunk.includes("===OPEN_GAME_RESULT===")) {
              rawCode = chunk.split("===OPEN_GAME_RESULT===")[1].trim();
              break;
            } else if (chunk.includes("===OPEN_GAME_RESULT_ERROR===")) {
              throw new Error("OpenGame не смог сохранить результат: " + chunk.split("===OPEN_GAME_RESULT_ERROR===")[1]);
            } else {
              fullConsole += chunk;
              // Показываем в чате последние логи консоли (ограничиваем длину)
              const displayLogs = fullConsole.length > 500 ? "..." + fullConsole.slice(-500) : fullConsole;
              updateMessage(assistantId, {
                content: (beforeTag ? beforeTag + "\n\n" : "") + "🤖 **OpenGame работает:**\n```bash\n" + displayLogs + "\n```",
                isStreaming: true
              });
            }
          }
        } catch (e: any) {
          updateMessage(assistantId, { content: "❌ Ошибка запуска OpenGame: " + e.message, isStreaming: false });
          return;
        }
      }

      if (!rawCode || rawCode.length < 50) {
        updateMessage(assistantId, { content: "❌ Ошибка генерации кода.", isStreaming: false });
        return;
      }

      let finalCode = rawCode;
      const specMatch = rawCode.match(/<game_spec>([\s\S]*?)<\/game_spec>/i);
      if (specMatch) finalCode = specMatch[1].trim();

      finalCode = finalCode
        .replace(/https:\/\/pixijs\.download\/release\/pixi\.js/g, "https://cdnjs.cloudflare.com/ajax/libs/pixi.js/6.5.10/pixi.min.js")
        .replace(/width:\s*canvas\.width/g, "width: window.innerWidth")
        .replace(/height:\s*canvas\.height/g, "height: window.innerHeight")
        .replace(/```[a-z]*\n/gi, '').replace(/```/g, '');
      
      try {
        const parsedFiles = parseMultiFile(finalCode);
        const codeForPreview = parsedFiles.length > 0 ? mergeFilesForPreview(parsedFiles) : finalCode;

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Черновик игры готов!**\n\n🛠 **Код загружен в Студию.** Внеси правки и нажми «Опубликовать», чтобы игра появилась в общей ленте.`,
          gameCode: codeForPreview,
          isStreaming: false,
          deployState: { 
            phase: "ready", 
            status: "Черновик готов",
            pagesUrl: "", // Нет ссылки до публикации
          }
        });

        // Автоматически загружаем в студию (через пропсы ChatMessageItem или внешнее событие)
        console.log("Game draft ready for Studio");

      } catch (pubErr: any) {
        updateMessage(assistantId, { 
          content: `⚠️ Публикация не удалась: ${pubErr.message}`, 
          deployState: { phase: "error", error: pubErr.message },
          isStreaming: false 
        });
      }

    } catch (e: any) {
      updateMessage(assistantId, { content: `❌ Ошибка: ${e.message}`, isStreaming: false });
    } finally {
      setIsRunning(false);
      setStep("");
      setTargetRepo(null);
    }
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, streamWithFallback]);

  const stop = useCallback(() => { abortRef.current?.abort(); setIsRunning(false); setStep(""); }, []);
  const reset = useCallback(() => {
    setMessages([]); chatHistory.current = [];
    localStorage.removeItem("smol_agent_messages_v1"); localStorage.removeItem("smol_agent_history_v1");
  }, []);

  return { messages, isRunning, step, sendMessage, stop, reset };
}
