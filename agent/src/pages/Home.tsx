import { useState, useRef, useEffect } from "react";
import { useGameAgent } from "@/hooks/useGameAgent";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, Github, Layout, MessageSquare, Play, Pencil, RotateCcw } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { SmolGameAPI } from "@/lib/smolgame-api";
import { Component, type ReactNode } from "react";

// Загружаем настройки из localStorage
function loadSettings() {
  const saved = localStorage.getItem("smol_chat_settings_v3");
  if (!saved) return { primaryProvider: "openrouter", keys: {}, models: {}, autoFailover: true, maxRetries: 3 };
  try { return JSON.parse(saved); } catch { return { primaryProvider: "openrouter", keys: {}, models: {}, autoFailover: true, maxRetries: 3 }; }
}

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
  const settings = loadSettings();
  const { messages, isRunning, step, sendMessage, stop, reset } = useGameAgent(settings);
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "studio">("chat");
  const [myGames, setMyGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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
        <main className="flex-1 flex flex-col min-w-0 relative h-full">
          {authLoading && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0b0e]">
              <div className="w-6 h-6 border-2 border-[#a3b8d4] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 z-30 shrink-0 border-b border-white/5 bg-[#0a0b0e]/80 backdrop-blur-md">
            <div className="flex items-center gap-2">
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
                <Button
                  variant="ghost" size="sm"
                  className="h-9 px-3 bg-[#13141a] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white/30 hover:text-white transition-all ml-2"
                  onClick={reset}
                >
                  <RotateCcw size={12} className="mr-2" /> Новый чат
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500">
                  <Github size={14} />
                  {user.photo_url && <img src={user.photo_url} alt="avatar" className="w-5 h-5 rounded-full border border-green-500/30" />}
                </div>
              ) : (
                <Button variant="ghost" size="sm"
                  className="h-9 px-3 bg-[#13141a] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#a3b8d4] hover:text-white transition-all"
                  onClick={login}
                >
                  <Github size={14} className="mr-2" /> Войти
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
                          onSwitchTab={setActiveTab}
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
                <div className="max-w-2xl mx-auto px-6 py-10">
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
                    <div className="grid gap-4">
                      {myGames.map((game) => (
                        <div key={game.id} className="group relative flex flex-col p-4 rounded-2xl bg-[#13141a] border border-white/5 hover:border-white/10 transition-all">
                          <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold text-lg text-white group-hover:text-blue-400 transition-colors truncate">{game.title}</h3>
                              <p className="text-xs text-white/40 line-clamp-2 mt-1">{game.description || "Без описания"}</p>
                            </div>
                            <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-2xl shrink-0">
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
                              className="flex-1 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-[10px] font-black uppercase tracking-widest h-10 rounded-xl border border-blue-500/20"
                              onClick={() => { setActiveTab("chat"); sendMessage(`Давай улучшим игру: ${game.title}`); }}
                            >
                              <Pencil size={14} className="mr-2" /> Переделать
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                      <Layout className="w-12 h-12 text-white/10 mx-auto mb-4" />
                      <p className="text-white/40 font-medium">У вас пока нет опубликованных игр</p>
                    </div>
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
                  Agent 4.0 • Vercel AI SDK • Tool Calling
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ErrorBoundary>
  );
}
