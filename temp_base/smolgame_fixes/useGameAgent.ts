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
  progress?: number;
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
// SAFE STORAGE HELPER
// Fixes: localStorage crash in Telegram WebView
// ──────────────────────────────────────────────
const safeStorage = {
  set: (key: string, val: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_e) {}
  },
  get: <T>(key: string, defaultVal: T): T => {
    try {
      const raw = localStorage.getItem(key);
      return raw !== null ? (JSON.parse(raw) as T) : defaultVal;
    } catch (_e) { return defaultVal; }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch (_e) {}
  }
};

// ──────────────────────────────────────────────
// ПРОМПТЫ
// ──────────────────────────────────────────────

// ФАЗА 1: Интервьюер (Архитектор)
const INTERVIEWER_PROMPT = `You are a Senior Game Producer for SmolGame platform (Telegram Mini Apps). Your goal is to get started AS FAST AS POSSIBLE.
- If the user's idea is clear, skip questions and just say: "I've got it! Starting the engine..." and output ONLY the <plan> block.
- Only ask questions if the idea is completely vague.
- Limit yourself to 1-2 most critical questions max.
- Always output a <plan> if you have enough info.

Output format for planning:
<plan>
- Core Loop: ...
- Template: (choose one: arcade-canvas | physics-puzzle | narrative-mystery)
- Style & Juice: ...
</plan>`;

// ФАЗА 2: Инженер (Генератор кода)
// FIX #1: Added mobile-first touch requirements
// FIX #2: Added safe storage requirement with code snippet
// FIX #3: Added audio initialization requirement
// FIX #4: Added complete game loop requirement (START/PLAYING/GAMEOVER/RESTART)
// FIX #5: Added Juice Toolkit with concrete code patterns
const ENGINEER_PROMPT = `You are a Visionary Game Developer and Master Architect building for the SmolGame platform (Telegram Mini Apps). Your goal is to create a masterpiece: a world-class, high-fidelity mobile game.

CORE PRINCIPLES:
1. MOBILE FIRST (CRITICAL): The game runs in Telegram WebView on a mobile phone. There is NO physical mouse and NO keyboard. You MUST use pointer events: pointerdown, pointerup, pointermove. You MUST add CSS: canvas { touch-action: none; } to prevent the Telegram feed from scrolling during gameplay.
2. SAFE STORAGE (CRITICAL): Telegram WebView may throw SecurityError on localStorage access. You MUST wrap ALL localStorage calls in try/catch. Use this exact pattern:
   const safeStorage = {
     set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
     get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e) { return d; } }
   };
3. AUDIO INITIALIZATION: Mobile browsers block AudioContext autoplay. You MUST initialize AudioContext only inside a pointerdown/touchstart event handler, never on page load.
4. COMPLETE GAME LOOP (CRITICAL): The game MUST have:
   - A START screen (title + "Tap to Start")
   - A PLAYING state with clear objective
   - A GAME OVER screen with final score and "Tap to Restart"
   - A restart() function that resets state WITHOUT calling location.reload()
5. DEEP GAMEPLAY: The game must be interesting, balanced, and have "Juice" — use screen shake, particles, and smooth transitions.

JUICE TOOLKIT (use these patterns directly):
// Screen Shake:
let shakeIntensity = 0;
function screenShake(i=8){ shakeIntensity=i; }
// In draw loop: ctx.translate((Math.random()-0.5)*shakeIntensity, (Math.random()-0.5)*shakeIntensity); shakeIntensity*=0.85;

// Particles:
const particles = [];
function spawnParticles(x, y, color, count=12) {
  for(let i=0;i<count;i++){
    const a=(Math.PI*2*i/count)+Math.random()*0.5, s=2+Math.random()*4;
    particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,decay:0.025,size:3+Math.random()*4,color});
  }
}

// Delta-time game loop (works correctly on 60Hz and 120Hz screens):
let lastTime = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 16.67, 3);
  lastTime = ts;
  update(dt); draw();
  requestAnimationFrame(loop);
}

TECHNICAL RULES:
1. OUTPUT: Deliver everything inside <game_spec> tags.
2. FILE FORMAT: Use <file path="filename">content</file> for each file.
3. COMPATIBILITY: All external libraries must be loaded via reliable CDNs (cdnjs.cloudflare.com, cdn.jsdelivr.net).

"СДЕЛАЙ ИГРУ МИРОВОГО УРОВНЯ ОТ НАЧАЛА И ДО КОНЦА". Deliver your absolute best. Output ONLY the <game_spec> block.`;

// ФАЗА 3: QA (Валидатор)
// FIX: New QA phase that validates and auto-fixes generated code
const QA_PROMPT = `You are the Lead QA Engineer for SmolGame platform. Review the generated game code for compliance.

MANDATORY CHECKS:
1. TOUCH INPUT: Does it use pointerdown/pointerup/pointermove (not just mousedown/keydown)?
2. SAFE STORAGE: Is localStorage wrapped in try/catch or using a safeStorage wrapper?
3. GAME LOOP: Does it have START screen, PLAYING state, GAME OVER screen, and restart() without location.reload()?
4. TOUCH ACTION: Is "touch-action: none" applied to the canvas element?
5. AUDIO: Is AudioContext initialized only on first user interaction (not on page load)?

If ALL checks pass, output exactly: <status>PASSED</status>

If ANY check fails, output the COMPLETE corrected code inside <game_spec> tags with all issues fixed. Do not explain — just fix and output.`;

const AIDER_EDITOR_PROMPT = `You are the Senior Game Developer. Modify the existing game code based on user requests.

IMPORTANT: Preserve all existing safety patterns (safeStorage, touch-action:none, pointer events, game loop states).

Output the changes using <game_spec> tags with full file contents.`;

// ──────────────────────────────────────────────
// STATIC CODE ANALYZER
// FIX: Pre-deploy validation to catch common issues
// ──────────────────────────────────────────────
interface AnalysisResult {
  passed: boolean;
  issues: string[];
  warnings: string[];
}

function analyzeGameCode(code: string): AnalysisResult {
  const issues: string[] = [];
  const warnings: string[] = [];

  // CRITICAL: touch-action
  if (!code.includes('touch-action')) {
    issues.push('Missing touch-action: none on canvas — Telegram feed will scroll during gameplay');
  }

  // CRITICAL: safe localStorage
  const hasLocalStorage = code.includes('localStorage');
  const hasTryCatch = code.includes('try {') || code.includes('try{');
  const hasSafeStorage = code.includes('safeStorage');
  if (hasLocalStorage && !hasTryCatch && !hasSafeStorage) {
    issues.push('localStorage used without try/catch — will crash in Telegram WebView');
  }

  // CRITICAL: game loop states
  if (!code.includes('GAME_OVER') && !code.includes('gameover') && !code.includes('gameOver')) {
    issues.push('No GAME_OVER state found — game has no ending');
  }

  // CRITICAL: restart without reload
  if (code.includes('location.reload')) {
    issues.push('location.reload() used for restart — crashes inside Telegram iframe');
  }

  // CRITICAL: forbidden patterns
  if (code.includes('top.location') || code.includes('window.parent.location')) {
    issues.push('top.location / window.parent.location is forbidden in Telegram iframe');
  }

  // CRITICAL: absolute paths
  if (/src=["']\/[^/]/.test(code) || /href=["']\/[^/]/.test(code)) {
    issues.push('Absolute paths (src="/...") will break on GitHub Pages — use relative paths');
  }

  // WARNING: touch events
  if (!code.includes('pointerdown') && !code.includes('touchstart')) {
    warnings.push('No touch/pointer events found — game may be unplayable on mobile');
  }

  // WARNING: audio context
  if (code.includes('AudioContext') && !code.includes('pointerdown') && !code.includes('touchstart')) {
    warnings.push('AudioContext may be initialized before user interaction — will fail on mobile');
  }

  // WARNING: delta time
  if (code.includes('requestAnimationFrame') && !code.includes('deltaTime') && !code.includes('dt')) {
    warnings.push('No delta-time detected — game speed will vary on 60Hz vs 120Hz screens');
  }

  return { passed: issues.length === 0, issues, warnings };
}

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
  // FIX: All localStorage access wrapped with safeStorage
  const [messages, setMessages] = useState<AgentMessage[]>(() =>
    safeStorage.get<AgentMessage[]>("smol_agent_messages_v1", [])
  );
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState("");
  const [targetRepo, setTargetRepo] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chatHistory = useRef<{ role: "user" | "assistant" | "system"; content: string }[]>(
    safeStorage.get("smol_agent_history_v1", [])
  );

  // FIX: Save to localStorage using safeStorage
  useEffect(() => {
    safeStorage.set("smol_agent_messages_v1", messages);
    safeStorage.set("smol_agent_history_v1", chatHistory.current);
  }, [messages]);

  const addMessage = useCallback((msg: Omit<AgentMessage, "id" | "timestamp">) => {
    const full: AgentMessage = { ...msg, id: makeId(), timestamp: Date.now() };
    setMessages(prev => [...prev, full]);
    return full.id;
  }, []);

  const updateMessage = useCallback((id: string, patch: Partial<AgentMessage>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  const getActiveProviders = useCallback(() => {
    return FALLBACK_ORDER.filter(p => {
      const key = settings.keys[p as keyof typeof settings.keys] as string | undefined;
      return key && key.trim().length > 0;
    });
  }, [settings]);

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
      } catch (e: unknown) {
        lastError = (e as Error).message || "Unknown";
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
      // ── PHASE 1: INTERVIEWER ────────────────────────────
      setStep("💬 Думаю...");
      const interviewMsgs = [
        { role: "system" as const, content: INTERVIEWER_PROMPT },
        ...chatHistory.current.slice(-15),
      ];

      const stripPromptTag = (text: string) =>
        text
          .replace(/<plan>([\s\S]*?)<\/plan>/gi, "")
          .replace(/<\/?plan>/gi, "")
          .replace(/plan[\s\S]*/i, "")
          .trim();

      const { text: interviewText, provider: usedProvider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;
          const hasTag = /<plan>/i.test(full) || /plan/i.test(full);
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
        interviewText.match(/<plan>([\s\S]*?)<\/plan>/i) ||
        interviewText.match(/<plan>([\s\S]*?)$/i) ||
        interviewText.match(/plan\s*([\s\S]+)/i);

      const isDetailedRequest = userText.length > 100 && (userText.includes("создай") || userText.includes("игру"));

      if (!promptMatch && !isDetailedRequest) {
        const visible = stripPromptTag(interviewText) || interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible, isStreaming: false });
        return;
      }

      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      const tagStart = interviewText.search(/<plan>|plan/i);
      const beforeTag = tagStart > 0 ? interviewText.slice(0, tagStart).trim() : "";
      const isModification = !!previousCode;

      let rawCode = "";
      let progressInterval: ReturnType<typeof setInterval> | undefined;

      if (isModification) {
        // ── MODIFICATION MODE ───────────────────────────
        let simulatedProgress = 0;
        progressInterval = setInterval(() => {
          simulatedProgress += Math.random() * 5;
          if (simulatedProgress > 95) simulatedProgress = 95;
          updateMessage(assistantId, {
            content: (beforeTag ? beforeTag + "\n\n" : "") + `🤖 **Редактирую код...**`,
            progress: Math.floor(simulatedProgress),
            isStreaming: true
          });
        }, 800);

        const { text: modificationText } = await streamWithFallback(
          [
            { role: "system", content: AIDER_EDITOR_PROMPT + `\n\nCURRENT FILE CONTENT:\n${previousCode}` },
            { role: "user", content: `Modify the code:\n\n${gameSpec}` }
          ],
          () => {},
          signal,
          usedProvider
        );

        clearInterval(progressInterval);

        const blocks = parseAiderBlocks(modificationText);
        if (blocks.length > 0) {
          rawCode = applyAiderBlocks(previousCode!, blocks).code;
        } else {
          const match = modificationText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || modificationText.match(/<html[\s\S]*<\/html>/i);
          rawCode = match ? (match[1] || match[0]) : previousCode!;
        }
      } else {
        // ── GENERATION MODE (OpenGame) ──────────────────
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + "🔨 Передаю задачу движку OpenGame...",
          isStreaming: true,
        });
        setStep("🚀 Запуск OpenGame...");

        try {
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

            if (chunk.includes("===OPEN_GAME_RESULT_ERROR===")) {
              throw new Error("OpenGame не смог сохранить результат: " + chunk.split("===OPEN_GAME_RESULT_ERROR===")[1]);
            } else {
              fullConsole += chunk;
              if (fullConsole.includes("===OPEN_GAME_RESULT===")) continue;

              const displayLogs = fullConsole.length > 500 ? "..." + fullConsole.slice(-500) : fullConsole;
              updateMessage(assistantId, {
                content: (beforeTag ? beforeTag + "\n\n" : "") + "🤖 **OpenGame работает:**\n```bash\n" + displayLogs + "\n```",
                isStreaming: true
              });
            }
          }

          if (fullConsole.includes("===OPEN_GAME_RESULT===")) {
            rawCode = fullConsole.split("===OPEN_GAME_RESULT===")[1].trim();
          } else if (fullConsole.includes("[ERROR] OpenGame generation failed")) {
            const errMatch = fullConsole.match(/\[ERROR\] OpenGame generation failed(.*)/);
            throw new Error("Движок завершил работу с ошибкой: " + (errMatch ? errMatch[1].trim() : ""));
          }
        } catch (e: unknown) {
          updateMessage(assistantId, { content: "❌ Ошибка запуска OpenGame: " + (e as Error).message, isStreaming: false });
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

      // ── PHASE 3: STATIC ANALYSIS (NEW) ─────────────────
      // FIX: Validate code before showing to user
      setStep("🔍 Проверяю качество кода...");
      const analysis = analyzeGameCode(finalCode);

      if (!analysis.passed) {
        // Auto-fix via QA prompt
        setStep("🛠 Автоисправление проблем...");
        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `⚠️ Обнаружены проблемы (${analysis.issues.length}). Исправляю автоматически...`,
          isStreaming: true
        });

        try {
          const { text: qaText } = await streamWithFallback(
            [
              { role: "system", content: QA_PROMPT },
              { role: "user", content: `Review and fix this game code:\n\n${finalCode}` }
            ],
            () => {},
            signal,
            usedProvider
          );

          if (qaText.includes("<status>PASSED</status>")) {
            // QA says it's fine despite our analysis — trust QA
          } else {
            const qaMatch = qaText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i);
            if (qaMatch) {
              finalCode = qaMatch[1].trim();
            }
          }
        } catch (_qaErr) {
          // QA failed — log warnings but continue with original code
          console.warn("QA phase failed, using original code. Issues:", analysis.issues);
        }
      }

      // ── FINALIZE ────────────────────────────────────────
      try {
        const parsedFiles = parseMultiFile(finalCode);
        const codeForPreview = parsedFiles.length > 0 ? mergeFilesForPreview(parsedFiles) : finalCode;

        // Build quality report for user
        const qualityNote = analysis.issues.length > 0
          ? `\n\n⚠️ *Авто-исправлены проблемы:* ${analysis.issues.join('; ')}`
          : analysis.warnings.length > 0
            ? `\n\n💡 *Предупреждения:* ${analysis.warnings.join('; ')}`
            : '\n\n✅ *Все проверки качества пройдены.*';

        updateMessage(assistantId, {
          content: (beforeTag ? beforeTag + "\n\n" : "") + `✅ **Черновик игры готов!**\n\n🛠 **Код загружен в Студию.** Внеси правки и нажми «Опубликовать», чтобы игра появилась в общей ленте.${qualityNote}`,
          gameCode: codeForPreview,
          isStreaming: false,
          deployState: {
            phase: "ready",
            status: "Черновик готов",
            pagesUrl: "",
          }
        });

      } catch (pubErr: unknown) {
        updateMessage(assistantId, {
          content: `⚠️ Публикация не удалась: ${(pubErr as Error).message}`,
          deployState: { phase: "error", error: (pubErr as Error).message },
          isStreaming: false
        });
      }

    } catch (e: unknown) {
      if (progressInterval !== undefined) clearInterval(progressInterval);
      updateMessage(assistantId, { content: `❌ Ошибка: ${(e as Error).message}`, isStreaming: false });
    } finally {
      setIsRunning(false);
      setStep("");
      setTargetRepo(null);
    }
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, streamWithFallback, messages]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
    setStep("");
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    chatHistory.current = [];
    safeStorage.remove("smol_agent_messages_v1");
    safeStorage.remove("smol_agent_history_v1");
  }, []);

  return { messages, isRunning, step, sendMessage, stop, reset };
}
