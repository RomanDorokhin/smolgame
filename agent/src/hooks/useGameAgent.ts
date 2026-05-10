import { useState, useCallback, useRef, useEffect } from "react";
import { generateStream, LLMConfig } from "@/lib/llm-api";
import { SmolGameAPI } from "@/lib/smolgame-api";
import type { APIProvider, ChatSettings } from "@/types/chat";
import { pool } from "@/lib/llm-api";
import { INTERVIEWER_PROMPT, AIDER_EDITOR_PROMPT } from "./agent_prompts";
import { generateGame } from "@/lib/sep/gameGenerationPipelinePro";
import { analyzeGameCode } from "@/lib/sep/game-code-analyzer";

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

const FALLBACK_ORDER: APIProvider[] = ["groq", "gemini", "openrouter", "together", "deepseek", "sambanova", "glhf", "huggingface"];

const DEFAULT_MODELS: Record<string, string[]> = {
  groq: ["llama-3.3-70b-versatile"],
  gemini: ["gemini-2.0-flash"],
  openrouter: ["google/gemini-2.0-flash-001"],
  together: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  deepseek: ["deepseek-chat"],
  sambanova: ["Meta-Llama-3.1-70B-Instruct"],
  glhf: ["hf:meta-llama/Llama-3.1-70B-Instruct"],
  huggingface: ["meta-llama/Llama-3.2-11B-Vision-Instruct"],
};

const makeId = () => Math.random().toString(36).substring(2, 9);

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

export function useGameAgent(settings: ChatSettings) {
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

  const getLLMConfig = useCallback((provider: string): LLMConfig => {
    const apiKey = settings.keys[provider as keyof typeof settings.keys] as string;
    const model = (settings.models?.[provider as keyof typeof settings.models] as string | undefined)
      || DEFAULT_MODELS[provider]?.[0] || "gpt-3.5-turbo";
    return { provider: provider as any, apiKey, model };
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

      const config = getLLMConfig(providerId);

      try {
        if (i > 0) setStep(`🔄 Переключаюсь на ${providerId.toUpperCase()}...`);

        let fullText = "";
        const stream = generateStream(msgs, config, signal);

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
  }, [settings, getActiveProviders, getLLMConfig]);

  const sendMessage = useCallback(async (userText: string, repoToUpdate?: string) => {
    if (isRunning) return;

    if (repoToUpdate) setTargetRepo(repoToUpdate);

    addMessage({ role: "user", content: userText });
    chatHistory.current.push({ role: "user", content: userText });

    const assistantId = addMessage({ role: "assistant", content: "🤔 ...", isStreaming: true });
    setIsRunning(true);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;

    const activeProviders = getActiveProviders();
    if (activeProviders.length === 0) {
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
          .trim();

      const { text: interviewText, provider: usedProvider } = await streamWithFallback(
        interviewMsgs,
        (_chunk, full) => {
          if (signal.aborted) return;
          const hasTag = /<plan>/i.test(full);
          const visible = stripPromptTag(full);
          updateMessage(assistantId, {
            content: hasTag ? (visible || "🚀 ТЗ собрано! Подключаю команду агентов SEP...") : (visible || "🤔 ..."),
            isStreaming: true,
          });
        },
        signal
      );

      chatHistory.current.push({ role: "assistant", content: interviewText });

      // Improved trigger logic: Strict <plan> tag or clear intent
      const promptMatch = interviewText.match(/<plan>([\s\S]*?)<\/plan>/i);
      
      const isDetailedRequest = userText.length > 50 && (
        /создай|игру|сделай|построй/i.test(userText) || 
        /create|game|make|build/i.test(userText)
      );

      if (!promptMatch && !isDetailedRequest) {
        const visible = stripPromptTag(interviewText) || interviewText.replace(/<[^>]*>/g, "").trim();
        updateMessage(assistantId, { content: visible, isStreaming: false });
        setIsRunning(false);
        return;
      }

      const gameSpec = promptMatch ? promptMatch[1].trim() : userText;
      const lastCodeMessage = messages.slice().reverse().find(m => m.gameCode);
      const previousCode = lastCodeMessage?.gameCode;
      const isModification = !!previousCode;

      let finalCode = "";

      if (isModification) {
        setStep("🤖 Редактирую код...");
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
          finalCode = applyAiderBlocks(previousCode!, blocks).code;
        } else {
          const match = modificationText.match(/<game_spec>([\s\S]*?)<\/game_spec>/i) || modificationText.match(/<html[\s\S]*<\/html>/i);
          finalCode = match ? (match[1] || match[0]) : previousCode!;
        }
      } else {
        // --- 5-STAGE SEP PIPELINE ---
        setStep("🚀 Запуск SEP Pipeline...");
        
        // --- SEEDS v4.2 ---
        const ULTIMATE_RUNNER_SEED = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>SmolGame Engine v4.2</title>
    <style>
        body { margin: 0; overflow: hidden; background: #000; color: #fff; font-family: 'Press Start 2P', cursive; }
        canvas { display: block; margin: auto; }
        #loading-screen { position: absolute; inset: 0; background: #000; color: #0FF; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; }
        .spinner { width: 50px; height: 50px; border: 5px solid #0FF; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    <style>
        body { margin: 0; overflow: hidden; background: #000; color: #fff; }
        canvas { display: block; margin: auto; }
        #loading-screen { position: absolute; inset: 0; background: #000; color: #0FF; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; }
        .spinner { width: 50px; height: 50px; border: 5px solid #0FF; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div id="loading-screen"><div class="spinner"></div><div id="loading-text">SYNCING REALITY...</div></div>
    <canvas id="gameCanvas"></canvas>
    <script src="https://smolgame.ru/js/smol-core/smol-core.js" onerror="alert('CRITICAL: smol-core.js not found!')"></script>
    <!-- GAME_CONFIG_INJECTION_POINT -->
    <script>
        window.onerror = (m) => { 
            const el = document.getElementById('loading-text');
            if (el) el.innerHTML = '<div style="color:red; font-size:12px">ERROR: ' + m + '</div>';
            console.error(m);
        };
        const cfg = JSON.parse(document.getElementById('game-config-json').textContent);
        
        // Dynamic Font Loader
        if (cfg.visuals?.fontFamily) {
            const fontName = cfg.visuals.fontFamily;
            const link = document.createElement('link');
            link.href = 'https://fonts.googleapis.com/css2?family=' + fontName.replace(/ /g, '+') + ':wght@400;700&display=swap';
            link.rel = 'stylesheet';
            document.head.appendChild(link);
            document.body.style.fontFamily = "'" + fontName + "', sans-serif";
        }
        
        function bootGame() {
            if (typeof Smol === 'undefined') {
                setTimeout(bootGame, 100);
                return;
            }

            let state = { 
                score: 0, 
                speed: cfg.difficulty?.curve?.[0]?.gameSpeed || 5, 
                distance: 0, 
                powerups: { shield: 0, magnet: 0, boost: 0 } 
            };
            
            const player = { 
                x: 100, y: 0, 
                w: cfg.player?.size || 40, 
                h: cfg.player?.size || 40, 
                vy: 0, grounded: false, jumpCount: 0, isJumping: false, airTime: 0, 
                color: cfg.player?.color || "#0FF", 
                trail: [] 
            };
            let obstacles = []; let collectibles = [];

            function resetGame() {
                state = { 
                    score: 0, 
                    speed: cfg.difficulty?.curve?.[0]?.gameSpeed || 5, 
                    distance: 0, 
                    powerups: { shield: 0, magnet: 0, boost: 0 } 
                };
                player.x = 100; player.y = 0; player.vy = 0; player.trail = []; player.grounded = false; player.jumpCount = 0;
                obstacles = []; collectibles = [];
                Smol.State.set('playing');
            }

            function gameOver() {
                Smol.State.set('game_over');
                Smol.Effects.burst(player.x, player.y, 50, [player.color, '#F00']);
                Smol.Effects.shakeScreen(30, 0.5);
                Smol.Audio.tone(100, 0.5, 1, 'sawtooth');
                setTimeout(() => { Smol.Social.showMainButton("RETRY", () => resetGame()); }, 1000);
            }

            Smol.init("gameCanvas", {
                update: (dt, f) => {
                    if (!Smol.State.is('playing')) return;
                    player.vy += 0.6; player.y += player.vy;
                    player.isJumping = !player.grounded; if (player.isJumping) player.airTime += dt;
                    if (player.y + player.h > Smol.GY) { player.y = Smol.GY - player.h; player.vy = 0; player.grounded = true; player.jumpCount = 0; player.airTime = 0; player.isJumping = false; }
                    state.distance += state.speed * dt;
                    obstacles.forEach(o => o.x -= state.speed);
                    collectibles.forEach(c => c.x -= state.speed);
                    if (f % 60 === 0) {
                        const type = (cfg.world?.obstacleTypes || [{height:50,width:30,color:'#F00'}])[Math.floor(Math.random() * (cfg.world?.obstacleTypes?.length || 1))];
                        obstacles.push({ x: Smol.W, y: Smol.GY - type.height, w: type.width, h: type.height, color: type.color });
                    }
                    if (f % 90 === 0) {
                        const type = (cfg.world?.collectibleTypes || [{radius:10,color:'#0F0',scoreValue:10}])[0];
                        collectibles.push({ x: Smol.W, y: Smol.GY - 100 - Math.random() * 150, r: type.radius, color: type.color, value: type.scoreValue });
                    }
                    obstacles.forEach((o, i) => { if (Smol.Physics.hits(player, o, 10)) gameOver(); });
                    collectibles.forEach((c, i) => {
                        if (Math.sqrt((player.x - c.x)**2 + (player.y - c.y)**2) < c.r + player.w) {
                            state.score += c.value; collectibles.splice(i, 1); Smol.Audio.tone(cfg.audio?.sfx?.score?.freq || 800, 0.1);
                        }
                    });
                    try { // CUSTOM_UPDATE_LOGIC_HOOK
                    } catch(e) { console.warn("Hook Error:", e); }
                },
                render: (ctx, w, h, gy) => {
                    ctx.clearRect(0, 0, w, h);
                    Smol.Effects.applyScreenShake();
                    Smol.Effects.renderParallax(state.speed / 5);
                    ctx.fillStyle = cfg.world?.groundColor || "#333"; ctx.fillRect(0, gy, w, h - gy);
                    player.trail.push({x: player.x, y: player.y}); if (player.trail.length > 10) player.trail.shift();
                    player.trail.forEach((t, i) => { ctx.globalAlpha = i / 15; ctx.fillStyle = player.color; ctx.fillRect(t.x, t.y, player.w, player.h); });
                    ctx.globalAlpha = 1; Smol.Render.gl(player.color, 15); ctx.fillRect(player.x, player.y, player.w, player.h); Smol.Render.ngl();
                    obstacles.forEach(o => { ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h); });
                    collectibles.forEach(c => { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI*2); ctx.fill(); });
                    Smol.Render.text("SCORE: " + Math.floor(state.score), w/2, 50, cfg.visuals?.hudColor || "#FFF");
                    if (Smol.State.is('intro')) Smol.Render.text("TAP TO START", w/2, h/2, "#FFF", 40);
                    if (Smol.State.is('game_over')) Smol.Render.text("GAME OVER", w/2, h/2, "#F00", 60);
                    Smol.Render.vignette(); Smol.Render.scanlines();
                }
            });

            Smol.Input.bind(() => {
                if (Smol.State.is('intro')) { Smol.State.set('playing'); document.getElementById('loading-screen').remove(); }
                else if (Smol.State.is('playing')) {
                    if (player.grounded || (cfg.player?.doubleJumpEnabled && player.jumpCount < 1)) {
                        player.vy = -(cfg.player?.jumpHeight || 12); player.grounded = false; player.jumpCount++;
                        Smol.Audio.tone(cfg.audio?.sfx?.jump?.freq || 400, 0.1);
                    }
                }
            });
            (cfg.visuals?.parallaxLayers || []).forEach(l => { if (l.assetUrl && l.assetUrl.startsWith('http')) Smol.Effects.addParallaxLayer(l.assetUrl, l.speed); });
            Smol.State.set('intro');
        }
        bootGame();
    </script>
</body>
</html>`;

        const PHYSICS_PUZZLE_SEED = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Smol Physics Puzzle</title>
    <style>
        body { margin: 0; overflow: hidden; background: #111; color: #fff; font-family: 'Press Start 2P', cursive; }
        canvas { display: block; margin: auto; }
        #loading-screen { position: absolute; inset: 0; background: #000; color: #0FF; display: flex; flex-direction: column; justify-content: center; align-items: center; z-index: 1000; }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
</head>
<body>
    <div id="loading-screen">READY TO SOLVE?</div>
    <canvas id="gameCanvas"></canvas>
    <script src="https://smolgame.ru/js/smol-core/smol-core.js" onerror="alert('CRITICAL: smol-core.js not found!')"></script>
    <!-- GAME_CONFIG_INJECTION_POINT -->
    <script>
        const cfg = JSON.parse(document.getElementById('game-config-json').textContent);
        let state = { score: 0, level: 1, balls: 5 };
        let objects = [];
        function resetGame() {
            objects = [];
            state.balls = 5;
            objects.push({ x: Smol.W - 100, y: Smol.H - 100, w: 50, h: 50, type: 'goal', color: '#0F0' });
            cfg.world.obstacleTypes.forEach(o => {
                objects.push({ x: Math.random() * Smol.W, y: Math.random() * Smol.H, w: o.width, h: o.height, type: 'wall', color: o.color });
            });
            Smol.State.set('playing');
        }
        Smol.init("gameCanvas", {
            update: (dt) => {
                if (!Smol.State.is('playing')) return;
                objects.forEach(o => {
                    if (o.type === 'ball') {
                        o.vy += 0.2; o.x += o.vx; o.y += o.vy;
                        if (o.y > Smol.H) objects.splice(objects.indexOf(o), 1);
                        if (o.x > Smol.W - 100 && o.y > Smol.H - 100) { Smol.State.set('game_over'); alert('WIN!'); }
                    }
                });
                try { // CUSTOM_UPDATE_LOGIC_HOOK 
                } catch(e) {}
            },
            render: (ctx, w, h) => {
                ctx.clearRect(0, 0, w, h);
                objects.forEach(o => {
                    ctx.fillStyle = o.color; ctx.fillRect(o.x, o.y, o.w, o.h);
                });
                Smol.Render.text("BALLS: " + state.balls, 100, 50);
                if (Smol.State.is('intro')) Smol.Render.text("TAP TO DROP", w/2, h/2, "#FFF", 20);
                if (Smol.State.is('game_over')) Smol.Render.text("LEVEL CLEAR", w/2, h/2, "#0F0", 40);
            }
        });
        Smol.Input.bind((x, y) => {
            if (Smol.State.is('intro')) { Smol.State.set('playing'); document.getElementById('loading-screen').remove(); resetGame(); }
            else if (Smol.State.is('playing') && state.balls > 0) {
                objects.push({ x: x || 50, y: 50, vx: 2, vy: 0, w: 20, h: 20, type: 'ball', color: cfg.player.color });
                state.balls--; Smol.Audio.tone(cfg.audio.sfx.jump.freq, 0.1);
            } else if (Smol.State.is('game_over')) { resetGame(); }
        });
        Smol.State.set('intro');
    </script>
</body>
</html>`;

        let progressLogs = "";
        const generateWithFallback = async (msgs: any[]) => {
          const result = await streamWithFallback(msgs, () => {}, signal, usedProvider);
          return result.text;
        };

        const result = await generateGame(gameSpec, {
          generateFn: generateWithFallback,
          goldenSeeds: { 
            "ultimate-runner-seed": ULTIMATE_RUNNER_SEED,
            "physics-puzzle-seed": PHYSICS_PUZZLE_SEED
          },
          onProgress: (msg) => {
            progressLogs += `> ${msg}\n`;
            updateMessage(assistantId, {
              content: "🤖 **SEP Pipeline:**\n\`\`\`bash\n" + progressLogs + "\n\`\`\`",
              isStreaming: true
            });
          }
        });

        if (result.isSuccess && result.generatedCode) {
          finalCode = result.generatedCode;
        } else {
          throw new Error(result.errors.join("\n") || "SEP Pipeline failed.");
        }
      }

      if (!finalCode || finalCode.length < 50) throw new Error("Empty code generated.");

      finalCode = finalCode.replace(/```[a-z]*\n/gi, '').replace(/```/g, '');
      const analysis = analyzeGameCode(finalCode);

      updateMessage(assistantId, {
        content: `✅ **Игра готова!** Сочность: ${analysis.juiceScore}%`,
        gameCode: finalCode,
        isStreaming: false,
        deployState: { phase: "ready", status: "Готово", pagesUrl: "" }
      });

    } catch (e: unknown) {
      updateMessage(assistantId, { content: `❌ Ошибка: ${(e as Error).message}`, isStreaming: false });
    } finally {
      setIsRunning(false);
      setStep("");
      setTargetRepo(null);
    }
  }, [isRunning, settings, addMessage, updateMessage, getActiveProviders, getLLMConfig, streamWithFallback, messages]);

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
