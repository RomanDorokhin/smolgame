import { useState, useRef, useEffect } from "react";
import { useGameAgent } from "@/hooks/useGameAgent";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Menu, Sparkles, Github, Layout, MessageSquare, Play, Pencil, RotateCcw, X, ChevronDown, ChevronUp, Key, Trash2, Save, FileCode, Monitor, Smartphone, Maximize2, ExternalLink, ArrowLeft, Loader2, CheckCircle2, MoreVertical, Sparkles as SparkleIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/_core/hooks/useAuth";
import { SmolGameAPI } from "@/lib/smolgame-api";
import { Component, type ReactNode } from "react";
import type { ChatSettings, APIProvider } from "@/types/chat";
import Editor from "@monaco-editor/react";
import { Panel, Group, Separator } from "react-resizable-panels";
import { Progress } from "@/components/ui/progress";

function loadSettings(): ChatSettings {
  const saved = localStorage.getItem("smol_chat_settings_v3");
  if (!saved) return { primaryProvider: "openrouter", keys: {}, models: {}, autoFailover: true, maxRetries: 3 };
  try { return JSON.parse(saved); } catch { return { primaryProvider: "openrouter", keys: {}, models: {}, autoFailover: true, maxRetries: 3 }; }
}

function saveSettings(s: ChatSettings) {
  localStorage.setItem("smol_chat_settings_v3", JSON.stringify(s));
}

const PROVIDERS: { id: APIProvider; name: string; url: string }[] = [
  { id: "groq", name: "Groq", url: "https://console.groq.com/keys" },
  { id: "gemini", name: "Google Gemini", url: "https://aistudio.google.com/app/apikey" },
  { id: "openrouter", name: "OpenRouter", url: "https://openrouter.ai/keys" },
  { id: "together", name: "Together AI", url: "https://api.together.xyz/settings/api-keys" },
  { id: "deepseek", name: "DeepSeek", url: "https://platform.deepseek.com/api_keys" },
  { id: "huggingface", name: "HuggingFace", url: "https://huggingface.co/settings/tokens" },
];

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-[#0a0b0e]">
          <h2 className="text-xl font-bold text-white mb-4">Упс, что-то пошло не так</h2>
          <Button onClick={() => window.location.reload()} className="bg-[#1c1e26] border border-white/10">Обновить</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const [settings, setSettings] = useState<ChatSettings>(loadSettings);
  const { messages, isRunning, step, sendMessage, stop, reset } = useGameAgent(settings);
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "studio">(() => {
    return (localStorage.getItem("smolgame_active_tab") as "chat" | "studio") || "chat";
  });
  const [myGames, setMyGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [studioGame, setStudioGame] = useState<{ title: string; code: string } | null>(() => {
    const saved = localStorage.getItem("smol_studio_game_v1");
    return saved ? JSON.parse(saved) : null;
  });

  // Sync activeTab to localStorage
  useEffect(() => {
    localStorage.setItem("smolgame_active_tab", activeTab);
  }, [activeTab]);

  // Sync studioGame to localStorage
  useEffect(() => {
    if (studioGame) {
      localStorage.setItem("smol_studio_game_v1", JSON.stringify(studioGame));
    } else {
      localStorage.removeItem("smol_studio_game_v1");
    }
  }, [studioGame]);
  const [expandedProvider, setExpandedProvider] = useState<APIProvider | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{ status: string; progress: number } | null>(null);
  const [studioMode, setStudioMode] = useState<"code" | "preview" | "split">("split");
  const [userHasScrolled, setUserHasScrolled] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [chatInputValue, setChatInputValue] = useState("");
  const [studioSubTab, setStudioSubTab] = useState<"published" | "drafts">("published");

  useEffect(() => {
    if (studioGame?.code) {
      // Пытаемся починить пустой canvas, если он не на 100%
      const injectedCode = studioGame.code.includes('</body>') 
        ? studioGame.code.replace(/<\/body>/i, `
        <script>
          (function() {
            const fixCanvas = () => {
              const canvases = document.querySelectorAll('canvas');
              canvases.forEach(c => {
                if (c.width === 0 || c.height === 0 || c.style.width === '0px') {
                  c.style.width = '100%';
                  c.style.height = '100%';
                  c.width = window.innerWidth;
                  c.height = window.innerHeight;
                }
              });
            };
            setTimeout(fixCanvas, 100);
            window.addEventListener('resize', fixCanvas);
          })();
        </script>
      </body>`)
        : `<html><body>${studioGame.code}</body></html>`;
        
      const blob = new Blob([injectedCode], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [studioGame?.code]);

  const handlePurgeCache = async () => {
    if (!window.confirm("Это удалит кэши моделей и браузера на сервере (около 1.5 ГБ). Это освободит место, но следующая генерация может занять больше времени. Продолжить?")) return;
    setIsPurging(true);
    try {
      const resp = await fetch(`https://smolgame.ru/api/opengame/purge-cache`, { method: "POST" });
      if (resp.ok) alert("Серверный кэш очищен!");
      else alert("Ошибка при очистке.");
    } catch (e) { alert("Ошибка сети."); }
    finally { setIsPurging(false); }
  };

  const drafts = messages
    .filter(m => m.role === "assistant" && m.gameCode)
    .map(m => ({
      id: m.id,
      title: m.content.split("\n")[0].replace(/[#*]/g, "").trim() || "Новая игра",
      code: m.gameCode!,
      timestamp: m.timestamp
    }))
    .reverse();

  // Сохраняем состояние Студии и вкладки
  useEffect(() => {
    localStorage.setItem("smolgame_active_tab", activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (studioGame) {
      localStorage.setItem("smol_studio_game_v1", JSON.stringify(studioGame));
    }
  }, [studioGame]);

  const updateSettings = (patch: Partial<ChatSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch };
      saveSettings(next);
      return next;
    });
  };

  const updateKey = (provider: APIProvider, key: string) => {
    const next = { ...settings, keys: { ...settings.keys, [provider]: key } };
    saveSettings(next);
    setSettings(next);
  };

  const handleCleanup = async () => {
    if (!confirm("Удалить ВСЕ твои репозитории на GitHub? Это действие нельзя отменить.")) return;
    setIsCleaning(true);
    try {
      const data = await SmolGameAPI.getMyGames();
      const games = data.games || [];
      for (const game of games) {
        if (game.id) await SmolGameAPI.deleteGame(game.id);
      }
      alert(`Удалено игр: ${games.length}`);
      loadMyGames();
    } catch (e) {
      alert("Ошибка при очистке");
    } finally {
      setIsCleaning(false);
    }
  };

  useEffect(() => {
    if (activeTab === "studio" && isAuthenticated) loadMyGames();
  }, [activeTab, isAuthenticated]);

  const loadMyGames = async () => {
    setLoadingGames(true);
    try {
      const data = await SmolGameAPI.getMyGames();
      setMyGames(data.games || []);
    } catch (e) { console.error("Failed to load games", e); }
    finally { setLoadingGames(false); }
  };

  // Smart Autoscroll Logic
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const isAtBottom = target.scrollHeight - target.scrollTop <= target.clientHeight + 100;
    setUserHasScrolled(!isAtBottom);
  };

  useEffect(() => {
    if (!userHasScrolled && isRunning) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isRunning, userHasScrolled]);

  const scrollToBottom = () => {
    setUserHasScrolled(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const GENRE_PRESETS = [
    { title: "Бесконечный Раннер", emoji: "🏃", prompt: "Создай бесконечный раннер в стиле киберпанк с неоновыми цветами. Игрок управляет машиной, уворачивается от препятствий и собирает монеты. Добавь эффекты частиц." },
    { title: "Tower Defense", emoji: "🏰", prompt: "Сделай простую Tower Defense игру. Враги идут по извилистой тропинке, игрок может ставить башни за монеты. Башни стреляют по врагам." },
    { title: "Кликер (Idle)", emoji: "🖱️", prompt: "Создай залипательный Idle-кликер про добычу руды. По центру огромный камень. За клики дают руду, за руду можно покупать авто-буры и улучшать кирку." },
    { title: "Головоломка 2048", emoji: "🧩", prompt: "Напиши клон игры 2048 с красивыми анимациями слияния плиток и современной цветовой палитрой." },
    { title: "Космический Шутер", emoji: "🚀", prompt: "Космический шутер с видом сверху. Корабль стреляет автоматически, игрок управляет мышью. Враги наступают волнами, из них выпадают бонусы на оружие." },
    { title: "Платформер", emoji: "🍄", prompt: "Классический 2D платформер с управлением на WASD/Стрелочки. Персонаж может прыгать, собирать ключи и открывать двери. Добавь пару типов врагов." },
    { title: "Flappy Bird", emoji: "🐦", prompt: "Сделай точный клон Flappy Bird. Управление по клику или пробелу. Трубы генерируются бесконечно. Добавь систему очков и экран окончания игры." },
    { title: "Змейка", emoji: "🐍", prompt: "Классическая игра змейка на сетке. Яблоки появляются в случайных местах. Сочные звуки поедания (или визуальные эффекты) и плавная анимация." }
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full bg-[#0a0b0e] text-white overflow-hidden font-sans">

        {/* ── API Keys Sidebar ─────────────────── */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-50 flex">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
            <div className="relative w-80 max-w-[90vw] h-full bg-[#0d0e14] border-r border-white/5 flex flex-col z-10">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <Key size={16} className="text-[#a3b8d4]" />
                  <span className="text-sm font-black uppercase tracking-widest">API Ключи</span>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/5 text-white/40 hover:text-white transition-all">
                  <X size={16} />
                </button>
              </div>
              <ScrollArea className="flex-1 px-4 py-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-4">Добавь хотя бы один ключ</p>
                <div className="space-y-2">
                  {PROVIDERS.map(p => {
                    const isExpanded = expandedProvider === p.id;
                    const hasKey = !!(settings.keys[p.id] as string | undefined)?.trim();
                    return (
                      <div key={p.id} className={`rounded-xl border transition-all ${hasKey ? "border-green-500/20 bg-green-500/5" : "border-white/5 bg-[#13141a]"}`}>
                        <button
                          className="w-full flex items-center justify-between px-4 py-3"
                          onClick={() => setExpandedProvider(isExpanded ? null : p.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${hasKey ? "bg-green-500" : "bg-white/10"}`} />
                            <span className="text-sm font-bold">{p.name}</span>
                          </div>
                          {isExpanded ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                        </button>
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3">
                            <Input
                              type="password"
                              placeholder="Вставь ключ сюда..."
                              value={(settings.keys[p.id] as string | undefined) || ""}
                              onChange={e => updateKey(p.id, e.target.value)}
                              className="bg-[#0a0b0e] border-white/10 text-white text-sm h-10 rounded-xl font-mono"
                            />
                            <a href={p.url} target="_blank" rel="noopener noreferrer"
                              className="block text-center text-[10px] text-[#a3b8d4] hover:text-white uppercase tracking-widest font-bold transition-colors">
                              Получить ключ →
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="p-4 border-t border-white/5 space-y-2">
                {drafts.length > 0 && (
                  <div className="mb-6">
                    <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold mb-3">Твои черновики</p>
                    <div className="space-y-1">
                      {drafts.map(d => (
                        <button
                          key={d.id}
                          onClick={() => {
                            setStudioGame({ title: d.title, code: d.code });
                            setActiveTab("studio");
                            setSidebarOpen(false);
                          }}
                          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all group text-left"
                        >
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                            <Play size={12} fill="currentColor" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold truncate text-white/70 group-hover:text-white">{d.title}</p>
                            <p className="text-[8px] text-white/20 uppercase font-black">{new Date(d.timestamp).toLocaleDateString()}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handlePurgeCache}
                  disabled={isPurging}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-amber-500/5 border-amber-500/10 hover:bg-amber-500/10 text-amber-400/70 h-10 rounded-xl text-[10px] font-bold uppercase"
                >
                  <Trash2 size={16} /> {isPurging ? "Чищу..." : "Очистить кэш сервера (1.5GB)"}
                </Button>

                <Button
                  onClick={handleCleanup}
                  disabled={isCleaning}
                  variant="outline"
                  className="w-full justify-start gap-3 bg-red-500/5 border-red-500/10 hover:bg-red-500/10 text-red-400/70 h-10 rounded-xl text-[10px] font-bold uppercase"
                >
                  <Trash2 size={16} /> {isCleaning ? "Удаляю..." : "Очистить репозитории"}
                </Button>
                <p className="text-[10px] text-white/20 text-center uppercase tracking-widest font-bold mt-2">Опасная зона</p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 flex flex-col min-w-0 relative h-full">
          {authLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0b0e]">
              <div className="w-6 h-6 border-2 border-[#a3b8d4] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 z-30 shrink-0 border-b border-white/[0.03] bg-black/40 backdrop-blur-xl">
            <div className="flex items-center gap-6">
              {/* Logo / Branding */}
              <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setActiveTab("chat")}>
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-900/30 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <Sparkles size={20} className="text-white fill-current" />
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-sm font-black tracking-tight text-white uppercase tracking-[0.1em]">Architect</span>
                  <span className="text-[8px] font-black text-blue-500/80 uppercase tracking-[0.3em]">SmolGame Studio</span>
                </div>
              </div>

              <div className="flex bg-white/[0.03] p-1.5 rounded-2xl border border-white/5 shadow-inner">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-2.5 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === "chat" ? "bg-white/10 text-white shadow-xl" : "text-white/30 hover:text-white/60"}`}
                >
                  <MessageSquare size={13} /> Chat
                </button>
                <button
                  onClick={() => setActiveTab("studio")}
                  className={`flex items-center gap-2.5 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === "studio" ? "bg-white/10 text-white shadow-xl" : "text-white/30 hover:text-white/60"}`}
                >
                  <Layout size={13} /> Studio
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {activeTab === "chat" && messages.length > 0 && (
                <Button variant="ghost" size="sm"
                  className="h-10 px-4 bg-white/[0.03] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/20 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300"
                  onClick={() => {
                    if (window.confirm("Очистить чат?")) reset();
                  }}
                >
                  <RotateCcw size={13} className="mr-2" /> Reset Session
                </Button>
              )}

              <button
                onClick={() => setSidebarOpen(true)}
                className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/20 hover:bg-white/5 transition-all duration-300 text-white/40 hover:text-white group"
              >
                <Menu size={18} className="group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === "chat" ? (
              <ScrollArea className="h-full" onScroll={handleScroll}>
                <div className="max-w-4xl mx-auto px-4 md:px-8 pb-10">
                  {messages.length === 0 ? (
                    <div className="min-h-[75vh] flex flex-col items-center justify-center py-20 px-6">
                      <div className="relative mb-12">
                        <div className="absolute inset-0 bg-blue-500/30 blur-[100px] animate-pulse rounded-full" />
                        <div className="w-24 h-24 rounded-[2.5rem] bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shadow-[0_20px_50px_rgba(37,99,235,0.4)] animate-float relative z-10">
                          <Sparkles className="text-white w-12 h-12 fill-current" />
                        </div>
                      </div>
                      <h2 className="text-4xl md:text-6xl font-black text-white mb-4 text-center tracking-tighter leading-tight">
                        Imagine. <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Create.</span> Play.
                      </h2>
                      <p className="text-white/40 text-[11px] mb-16 text-center max-w-sm font-black uppercase tracking-[0.4em] leading-relaxed">
                        Next-Gen Game Synthesis Engine v4.4
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 w-full max-w-5xl">
                        {GENRE_PRESETS.map((preset) => (
                          <button
                            key={preset.title}
                            onClick={() => setChatInputValue(preset.prompt)}
                            className="flex flex-col items-center p-10 bg-white/[0.02] border border-white/5 rounded-[3rem] hover:border-blue-500/40 hover:bg-blue-500/10 transition-all duration-500 group hover:-translate-y-3 hover:shadow-[0_30px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl relative overflow-hidden"
                          >
                            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                            <span className="text-5xl mb-6 group-hover:scale-125 group-hover:rotate-6 transition-transform duration-500 relative z-10">{preset.emoji}</span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-blue-400 transition-colors relative z-10">{preset.title}</span>
                            <div className="mt-4 w-6 h-1 bg-white/5 group-hover:w-12 group-hover:bg-blue-500 transition-all duration-500" />
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 pt-10">
                      {messages.map((m, i) => (
                        <ChatMessageItem
                          key={m.id || i}
                          message={m}
                          isLast={i === messages.length - 1}
                          onSend={sendMessage}
                          onSwitchTab={setActiveTab}
                          onLoadStudio={(title, code) => {
                            console.log("Studio received code. Title:", title, "Length:", code?.length);
                            setStudioGame({ title, code });
                          }}
                        />
                      ))}
                      
                      {userHasScrolled && isRunning && (
                        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50">
                          <Button 
                            onClick={scrollToBottom}
                            className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 h-9 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-900/40 animate-in fade-in slide-in-from-bottom-4"
                          >
                            Вниз <ChevronDown size={14} className="ml-2" />
                          </Button>
                        </div>
                      )}
                      
                      {isRunning && step && (
                        <div className="flex items-center gap-3 py-4 text-[#a3b8d4] animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce" />
                          <span className="text-[11px] font-bold uppercase tracking-tighter">{step}</span>
                        </div>
                      )}
                      <div ref={bottomRef} />
                    </div>
                  )}
                </div>
              </ScrollArea>
            ) : (
              <div className="h-full flex flex-col bg-[#0a0b0e]">
                {/* Studio Header / Breadcrumbs */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#0d0e14]">
                  <div className="flex items-center gap-4">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setStudioGame(null)}
                      className="h-9 w-9 p-0 rounded-xl bg-white/5 text-white/40 hover:text-white"
                    >
                      <ArrowLeft size={16} />
                    </Button>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-[10px] text-white/30 uppercase font-black tracking-widest">
                        <span>Студия</span>
                        <span>/</span>
                        <span className="text-[#a3b8d4]">{studioGame ? "Редактор" : "Мои игры"}</span>
                      </div>
                      <h2 className="text-sm font-bold text-white truncate max-w-[200px]">
                        {studioGame ? studioGame.title : "Управление проектами"}
                      </h2>
                    </div>
                  </div>

                  {studioGame && (
                    <div className="flex items-center gap-2">
                      <div className="flex bg-[#13141a] p-1 rounded-xl border border-white/5 mr-4">
                        <button 
                          onClick={() => setStudioMode("code")}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${studioMode === "code" ? "bg-white/10 text-white" : "text-white/40"}`}
                        >
                          Код
                        </button>
                        <button 
                          onClick={() => setStudioMode("split")}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${studioMode === "split" ? "bg-white/10 text-white" : "text-white/40"}`}
                        >
                          Сплит
                        </button>
                        <button 
                          onClick={() => setStudioMode("preview")}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${studioMode === "preview" ? "bg-white/10 text-white" : "text-white/40"}`}
                        >
                          Превью
                        </button>
                      </div>

                      {drafts.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-9 px-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[9px] font-black uppercase rounded-xl mr-4">
                              <RotateCcw size={14} className="mr-2" /> Версии
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64 bg-[#13141a] border-white/10 rounded-xl overflow-hidden p-1 shadow-xl z-[100]">
                            <div className="px-3 py-2 border-b border-white/5 mb-1">
                              <span className="text-[10px] text-white/50 font-black uppercase tracking-widest">История черновиков</span>
                            </div>
                            <ScrollArea className="max-h-60">
                              {drafts.map((d, idx) => (
                                <DropdownMenuItem 
                                  key={d.id}
                                  className="text-xs text-white/80 focus:bg-white/10 focus:text-white rounded-lg cursor-pointer p-2 flex flex-col items-start gap-1 mb-1"
                                  onClick={() => {
                                    if(window.confirm("Восстановить код из этого черновика? Текущие несохраненные изменения будут потеряны.")) {
                                      setStudioGame({ title: d.title, code: d.code });
                                    }
                                  }}
                                >
                                  <div className="flex items-center w-full items-center justify-between">
                                    <span className="font-bold truncate max-w-[150px]">{d.title}</span>
                                    <span className="text-[9px] text-white/30 uppercase">v{drafts.length - idx}</span>
                                  </div>
                                  <span className="text-[9px] text-white/40 font-mono">{new Date(d.timestamp).toLocaleTimeString()}</span>
                                </DropdownMenuItem>
                              ))}
                            </ScrollArea>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      <Button 
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 bg-white/5 border border-white/5 text-[9px] font-black uppercase text-[#a3b8d4] rounded-xl mr-4"
                        onClick={() => {
                          const blob = new Blob([studioGame.code], { type: 'text/html' });
                          window.open(URL.createObjectURL(blob), '_blank');
                        }}
                      >
                        <ExternalLink size={14} className="mr-2" /> Тест
                      </Button>

                      <Button 
                        disabled={!!publishProgress}
                        className="h-9 px-4 bg-green-600 hover:bg-green-700 text-white text-[9px] font-black uppercase tracking-widest rounded-xl shadow-lg shadow-green-900/20"
                        onClick={async () => {
                          if (!window.confirm("Опубликовать игру в общую ленту?")) return;
                          setPublishProgress({ status: "Инициализация...", progress: 10 });
                          try {
                            setPublishProgress({ status: "Сборка репозитория...", progress: 30 });
                            await new Promise(r => setTimeout(r, 800));
                            setPublishProgress({ status: "Загрузка кода...", progress: 60 });
                            
                            await SmolGameAPI.publishGame({
                              gameTitle: studioGame.title,
                              files: [{ path: "index.html", content: studioGame.code }],
                              gameDescription: "Создано и отполировано в Студии SmolGame."
                            });
                            
                            setPublishProgress({ status: "Активация GitHub Pages...", progress: 90 });
                            await new Promise(r => setTimeout(r, 1000));
                            setPublishProgress({ status: "Готово!", progress: 100 });
                            setTimeout(() => setPublishProgress(null), 2000);
                            loadMyGames();
                          } catch (err) {
                            alert("Ошибка: " + (err as Error).message);
                            setPublishProgress(null);
                          }
                        }}
                      >
                        {publishProgress ? (
                          <><Loader2 size={14} className="mr-2 animate-spin" /> {publishProgress.status}</>
                        ) : (
                          <><Play size={14} className="mr-2" /> Опубликовать</>
                        )}
                      </Button>
                    </div>
                  )}

                  {!studioGame && (
                    <div className="flex bg-[#13141a] p-1 rounded-xl border border-white/5">
                      <button 
                        onClick={() => setStudioSubTab("published")}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${studioSubTab === "published" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      >
                        Опубликованные
                      </button>
                      <button 
                        onClick={() => setStudioSubTab("drafts")}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${studioSubTab === "drafts" ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"}`}
                      >
                        Черновики
                      </button>
                    </div>
                  )}
                </div>

                {publishProgress && (
                  <div className="px-6 py-2 bg-green-500/5 border-b border-white/5">
                    <Progress value={publishProgress.progress} className="h-1 bg-green-500/10" />
                  </div>
                )}

                <div className="flex-1 overflow-hidden">
                  {studioGame ? (
                    <Group direction="horizontal" className="h-full">
                      {(studioMode === "code" || studioMode === "split") && (
                        <>
                          <Panel defaultSize={50} minSize={20}>
                            <Editor
                              theme="vs-dark"
                              defaultLanguage="html"
                              value={studioGame.code}
                              onChange={(val) => setStudioGame({ ...studioGame, code: val || "" })}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 13,
                                lineNumbers: "on",
                                roundedSelection: true,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                                padding: { top: 20 },
                                fontFamily: "JetBrains Mono, Menlo, monospace"
                              }}
                            />
                          </Panel>
                          {studioMode === "split" && <Separator className="w-1 bg-white/5 hover:bg-blue-500/50 transition-colors" />}
                        </>
                      )}
                      {(studioMode === "preview" || studioMode === "split") && (
                        <Panel defaultSize={50} minSize={20}>
                          <div className="h-full flex flex-col items-center justify-center bg-[#07080a] p-8">
                            <div className="relative w-full max-w-[380px] aspect-[9/16] rounded-[2.5rem] border-[10px] border-[#1a1b26] bg-black shadow-2xl overflow-hidden group">
                                <iframe
                                  key={`preview-${studioGame.title}`}
                                  title="Studio Live Preview"
                                  src={previewUrl || "about:blank"}
                                  width="100%"
                                  height="100%"
                                  className="w-full h-full border-none bg-transparent"
                                  sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-modals allow-forms allow-popups"
                                  allow="autoplay; fullscreen; pointer-lock"
                                />
                              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#1a1b26] rounded-b-2xl z-10" />
                            </div>
                            <div className="mt-6 flex items-center gap-4 text-white/20">
                              <Smartphone size={16} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Mobile Viewport</span>
                            </div>
                          </div>
                        </Panel>
                      )}
                    </Group>
                  ) : (
                    <ScrollArea className="h-full">
                      <div className="max-w-5xl mx-auto px-6 py-10">
                        {loadingGames && studioSubTab === "published" ? (
                          <div className="flex items-center justify-center py-20">
                            <div className="w-6 h-6 border-2 border-[#a3b8d4] border-t-transparent rounded-full animate-spin" />
                          </div>
                        ) : (studioSubTab === "published" ? myGames.length > 0 : drafts.length > 0) ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {(studioSubTab === "published" ? myGames : drafts).map((game, idx) => {
                              const gradients = [
                                "from-blue-600/20 via-blue-500/5 to-transparent",
                                "from-emerald-600/20 via-emerald-500/5 to-transparent",
                                "from-rose-600/20 via-rose-500/5 to-transparent",
                                "from-amber-600/20 via-amber-500/5 to-transparent",
                                "from-cyan-600/20 via-cyan-500/5 to-transparent"
                              ];
                              const bgGradient = gradients[idx % gradients.length];
                              const isDraft = studioSubTab === "drafts";
                              return (
                              <div key={game.id} className={`group flex flex-col p-7 rounded-[2.5rem] bg-[#13141a]/60 border border-white/5 hover:border-white/20 transition-all duration-500 hover:translate-y-[-8px] hover:shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl relative overflow-hidden`}>
                                <div className={`absolute inset-0 bg-gradient-to-br ${bgGradient} opacity-50 group-hover:opacity-100 transition-opacity duration-700`} />
                                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                   <SparkleIcon size={120} className="text-white" />
                                </div>
                                
                                <div className="relative z-10">
                                <div className="flex items-start justify-between mb-8">
                                  <div className="w-20 h-20 rounded-3xl bg-black/40 flex items-center justify-center text-4xl shadow-inner border border-white/10 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500">
                                    {game.genreEmoji || "🎮"}
                                  </div>
                                  <div className="flex gap-2">
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="w-10 h-10 p-0 rounded-2xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white border border-white/5">
                                          <MoreVertical size={16} />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end" className="w-48 bg-[#13141a]/95 backdrop-blur-xl border-white/10 rounded-2xl overflow-hidden p-1.5 shadow-2xl">
                                        <DropdownMenuItem 
                                          className="text-xs font-bold text-white/80 focus:bg-white/10 focus:text-white rounded-xl cursor-pointer flex items-center gap-3 p-3"
                                          onClick={async () => {
                                            setStudioGame({ title: game.title, code: "<!-- Загрузка кода... -->" });
                                            if (isDraft) {
                                              setStudioGame({ title: game.title, code: game.code });
                                            } else {
                                              try {
                                                const response = await fetch(game.url.endsWith('/') ? game.url + 'index.html' : game.url + '/index.html');
                                                const code = await response.text();
                                                setStudioGame({ title: game.title, code });
                                              } catch {
                                                setStudioGame({ title: game.title, code: "<!-- Ошибка загрузки кода -->" });
                                              }
                                            }
                                          }}
                                        >
                                          <div className="w-6 h-6 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
                                            <Pencil size={12} />
                                          </div>
                                          Править код
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                          className="text-xs font-bold text-blue-400 focus:bg-blue-500/10 focus:text-blue-300 rounded-xl cursor-pointer flex items-center gap-3 p-3"
                                          onClick={async () => {
                                            if (isDraft) {
                                              setStudioGame({ title: game.title, code: game.code });
                                              setActiveTab("chat");
                                              setChatInputValue("Добавь новые фичи, улучши графику и сделай игру сочнее.");
                                            } else {
                                              try {
                                                const response = await fetch(game.url.endsWith('/') ? game.url + 'index.html' : game.url + '/index.html');
                                                const code = await response.text();
                                                setStudioGame({ title: game.title, code });
                                                setActiveTab("chat");
                                                setChatInputValue("Добавь новые фичи, улучши графику и сделай игру сочнее.");
                                              } catch {
                                                alert("Не удалось загрузить код игры для улучшения.");
                                              }
                                            }
                                          }}
                                        >
                                          <div className="w-6 h-6 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                                            <SparkleIcon size={12} />
                                          </div>
                                          Улучшить AI
                                        </DropdownMenuItem>
                                        {!isDraft && (
                                          <DropdownMenuItem 
                                            className="text-xs font-bold text-red-400 focus:bg-red-500/10 focus:text-red-300 rounded-xl cursor-pointer flex items-center gap-3 p-3"
                                            onClick={async () => {
                                              if (window.confirm("Удалить игру?")) {
                                                await SmolGameAPI.deleteGame(game.id);
                                                loadMyGames();
                                              }
                                            }}
                                          >
                                            <div className="w-6 h-6 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400">
                                              <Trash2 size={12} />
                                            </div>
                                            Удалить
                                          </DropdownMenuItem>
                                        )}
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                </div>
                                <h3 className="font-black text-xl text-white mb-3 group-hover:text-blue-400 transition-colors tracking-tight">{game.title}</h3>
                                <p className="text-xs text-white/50 line-clamp-2 mb-8 leading-relaxed font-medium min-h-[3em]">{game.description || (isDraft ? "Черновик игры." : "Готовая к игре разработка.")}</p>
                                
                                <div className="mt-auto pt-6 border-t border-white/10 flex items-center justify-between">
                                  {isDraft ? (
                                    <Button 
                                      className="w-full h-14 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-lg shadow-blue-900/20"
                                      onClick={() => setStudioGame({ title: game.title, code: game.code })}
                                    >
                                      <Pencil size={18} className="mr-3" /> В РЕДАКТОР
                                    </Button>
                                  ) : (
                                    <Button 
                                      className="w-full h-14 bg-[#22c55e] hover:bg-[#16a34a] text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-2xl shadow-[0_10px_20px_0_rgba(34,197,94,0.3)] hover:shadow-[0_15px_30px_rgba(34,197,94,0.4)] hover:-translate-y-1 transition-all duration-300"
                                      onClick={() => window.open(game.url, "_blank")}
                                    >
                                      <Play size={18} fill="currentColor" className="mr-3" /> ИГРАТЬ СЕЙЧАС
                                    </Button>
                                  )}
                                </div>
                                </div>
                              </div>
                            )})}
                          </div>
                        ) : (
                          <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                            <Layout className="w-16 h-16 text-white/5 mx-auto mb-6" />
                            <h3 className="text-xl font-bold mb-2">{studioSubTab === "published" ? "Нет опубликованных игр" : "Нет черновиков"}</h3>
                            <p className="text-white/30 text-sm max-w-xs mx-auto mb-8">{studioSubTab === "published" ? "Вы еще не опубликовали ни одной игры." : "Создайте свою первую игру в чате с Агентом!"}</p>
                            <Button onClick={() => setActiveTab("chat")} className="bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest px-8 rounded-2xl">В Чат</Button>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Global Input */}
          <div className="px-4 py-4 md:px-8 md:py-6 bg-[#0a0b0e] border-t border-white/5 shrink-0">
            <div className="max-w-2xl mx-auto">
              <ChatInput
                value={chatInputValue}
                onChange={setChatInputValue}
                onSend={(text) => {
                  if (activeTab === "studio") setActiveTab("chat");
                  sendMessage(text);
                }}
                onStop={stop}
                isGenerating={isRunning}
                disabled={isRunning}
                placeholder={isRunning ? "Агент думает..." : "Опишите игру или попросите доработать текущую..."}
              />
              <div className="mt-3 text-[9px] text-center text-white/10 uppercase tracking-[0.2em] font-black">
                agent-smol v4.4-GODMODE • Phase: Plan + Code • Engine: LLM-API v3
              </div>
            </div>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
