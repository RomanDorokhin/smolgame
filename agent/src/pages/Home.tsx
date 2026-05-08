import { useState, useRef, useEffect } from "react";
import { useGameAgent } from "@/hooks/useGameAgent";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Menu, Sparkles, Github, Layout, MessageSquare, Play, Pencil, RotateCcw, X, ChevronDown, ChevronUp, Key } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SmolGameAPI } from "@/lib/smolgame-api";
import { Component, type ReactNode } from "react";
import type { ChatSettings, APIProvider } from "@/types/chat";

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
  const [activeTab, setActiveTab] = useState<"chat" | "studio">("chat");
  const [myGames, setMyGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const [studioGame, setStudioGame] = useState<{ title: string; code: string } | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<APIProvider | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isRunning]);

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
          <div className="flex items-center justify-between px-4 py-3 z-30 shrink-0 border-b border-white/5 bg-[#0a0b0e]/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
              {/* Hamburger — opens API keys sidebar */}
              <button
                onClick={() => setSidebarOpen(true)}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#13141a] border border-white/5 hover:border-white/15 transition-all text-white/60 hover:text-white"
              >
                <Menu size={16} />
              </button>

              <div className="flex bg-[#13141a] p-1 rounded-xl border border-white/5 ml-1">
                <button
                  onClick={() => setActiveTab("chat")}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "chat" ? "bg-white/10 text-white shadow-inner" : "text-white/40 hover:text-white/60"}`}
                >
                  <MessageSquare size={12} /> Чат
                </button>
                <button
                  onClick={() => setActiveTab("studio")}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "studio" ? "bg-white/10 text-white shadow-inner" : "text-white/40 hover:text-white/60"}`}
                >
                  <Layout size={12} /> Студия
                </button>
              </div>

              {activeTab === "chat" && messages.length > 0 && (
                <Button variant="ghost" size="sm"
                  className="h-9 px-3 bg-[#13141a] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all ml-2"
                  onClick={reset}
                >
                  <RotateCcw size={12} className="mr-2" /> Новый
                </Button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            {activeTab === "chat" ? (
              <ScrollArea className="h-full">
                <div className="max-w-2xl mx-auto px-4 pb-10">
                  {messages.length === 0 ? (
                    <div className="py-10 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-[#13141a] border border-white/5 flex items-center justify-center mx-auto mb-6">
                        <Sparkles className="w-8 h-8 text-[#a3b8d4]" />
                      </div>
                      <h2 className="text-2xl font-black mb-2">Smol-agent</h2>
                      <p className="text-sm text-white/40 max-w-xs mx-auto mb-10">Опишите идею игры, и я помогу её реализовать.</p>
                      <div className="space-y-2">
                        {[
                          { icon: "🚀", text: "Придумай идею для моей первой игры" },
                          { icon: "🐱", text: "Сделай игру про кота-путешественника" },
                          { icon: "🛡️", text: "Простая RPG механика" }
                        ].map((item, i) => (
                          <button key={i} onClick={() => sendMessage(item.text)}
                            className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#13141a] border border-white/5 hover:border-[#a3b8d4]/30 transition-all text-left group"
                          >
                            <span className="text-lg opacity-70 group-hover:opacity-100">{item.icon}</span>
                            <span className="text-sm font-medium text-white/60 group-hover:text-white">{item.text}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6 pt-6">
                      {messages.map((message, i) => (
                        <ChatMessageItem
                          key={message.id}
                          message={message as any}
                          isLast={i === messages.length - 1}
                          onSend={sendMessage}
                          onSwitchTab={(tab) => {
                            if (tab === "studio" && message.gameCode) {
                              setStudioGame({ 
                                title: message.content.split("\n")[0].replace(/^✅\s*/, "") || "Новая игра", 
                                code: message.gameCode 
                              });
                            }
                            setActiveTab(tab);
                          }}
                        />
                      ))}
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
              <ScrollArea className="h-full bg-[#0d0e14]">
                <div className="max-w-4xl mx-auto px-6 py-10 h-full flex flex-col">
                  {studioGame ? (
                    <div className="flex-1 flex flex-col gap-6 animate-in slide-in-from-right duration-300">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setStudioGame(null)}
                            className="w-10 h-10 p-0 rounded-xl bg-white/5 text-[#a3b8d4]"
                          >
                            <RotateCcw size={18} className="-rotate-90" />
                          </Button>
                          <div>
                            <h2 className="text-xl font-black">{studioGame.title}</h2>
                            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Режим редактирования</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest h-10 px-6 rounded-xl"
                            onClick={() => {
                              setActiveTab("chat");
                              sendMessage(`Добавь в игру "${studioGame.title}" новую функцию: `);
                            }}
                          >
                            <Pencil size={14} className="mr-2" /> Доработать
                          </Button>
                        </div>
                      </div>

                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                        <div className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl group">
                          <iframe
                            title="Studio Preview"
                            srcDoc={studioGame.code}
                            className="w-full h-full border-none"
                            sandbox="allow-scripts allow-pointer-lock"
                          />
                          <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-[9px] font-bold text-[#22c55e] uppercase tracking-widest">Live Preview</div>
                          </div>
                        </div>
                        <div className="bg-[#13141a] rounded-3xl border border-white/5 flex flex-col overflow-hidden">
                          <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white/20">Исходный код</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-7 text-[9px] text-[#a3b8d4]"
                              onClick={() => {
                                navigator.clipboard.writeText(studioGame.code);
                              }}
                            >
                              Копировать
                            </Button>
                          </div>
                          <ScrollArea className="flex-1">
                            <pre className="p-5 text-[11px] font-mono text-white/40 leading-relaxed overflow-x-auto">
                              <code>{studioGame.code}</code>
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h2 className="text-2xl font-black mb-1">Студия</h2>
                          <p className="text-xs text-white/40 uppercase tracking-widest font-bold">Ваши опубликованные игры</p>
                        </div>
                        <Button variant="ghost" size="sm" onClick={loadMyGames} className="text-[#a3b8d4]">Обновить</Button>
                      </div>
                      {loadingGames ? (
                        <div className="flex items-center justify-center py-20">
                          <div className="w-6 h-6 border-2 border-[#a3b8d4] border-t-transparent rounded-full animate-spin" />
                        </div>
                      ) : myGames.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {myGames.map((game) => (
                            <div key={game.id} className="group relative flex flex-col p-5 rounded-2xl bg-[#13141a] border border-white/5 hover:border-white/10 transition-all">
                              <div className="flex items-start justify-between gap-4 mb-4">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors truncate">{game.title}</h3>
                                  <p className="text-xs text-white/40 line-clamp-2 mt-1">{game.description || "Без описания"}</p>
                                </div>
                                <div className="w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
                                  {game.genreEmoji || "🎮"}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 mt-auto">
                                <Button
                                  className="flex-1 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest h-10 rounded-xl"
                                  onClick={() => window.open(game.url, "_blank")}
                                >
                                  <Play size={14} className="mr-2" /> Играть
                                </Button>
                                <Button
                                  className="flex-1 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 text-[10px] font-black uppercase tracking-widest h-10 rounded-xl border border-blue-500/10"
                                  onClick={() => {
                                    setStudioGame({ title: game.title, code: "<!-- Loading code from GitHub... -->" });
                                    // Here we would normally fetch the code, but for now we'll switch and show the placeholder
                                    // In a real app we'd fetch index.html from the repo
                                    setActiveTab("studio");
                                  }}
                                >
                                  <Pencil size={14} className="mr-2" /> Править
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                          <Layout className="w-12 h-12 text-white/10 mx-auto mb-4" />
                          <p className="text-white/40 font-medium text-sm">У вас пока нет опубликованных игр</p>
                          <Button 
                            variant="link" 
                            onClick={() => setActiveTab("chat")}
                            className="text-blue-400 text-xs font-black uppercase tracking-widest mt-2"
                          >
                            Создать первую игру
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Input */}
          {activeTab === "chat" && (
            <div className="px-4 py-4 md:px-8 md:py-6 bg-[#0a0b0e] border-t border-white/5 shrink-0">
              <div className="max-w-2xl mx-auto">
                <ChatInput
                  onSend={sendMessage}
                  onStop={stop}
                  isGenerating={isRunning}
                  disabled={isRunning}
                  placeholder={isRunning ? "Агент думает..." : "Опишите игру..."}
                />
                <div className="mt-3 text-[9px] text-center text-white/10 uppercase tracking-[0.2em] font-black">
                  Smol Architect v4.1 • Phase: Plan + Code • Engine: LLM-API v3
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
