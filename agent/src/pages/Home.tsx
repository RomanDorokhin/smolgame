import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, ShieldCheck, Copy, Check, Github } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Component, type ReactNode } from "react";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) { return { hasError: true, error }; }
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
  const {
    currentSession,
    sendMessage,
    stopGeneration,
    isGenerating,
    settings,
    updateSettings,
    generationStep,
    retryLastMessage,
    sessions,
    switchSession,
    createNewChat,
    deleteSession,
    clearAllSessions,
    factoryReset,
    usage,
    deployToGitHub,
    isPipelineRunning
  } = useChat();

  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession.messages, isGenerating]);

  return (
    <ErrorBoundary>
      <div className="flex h-full w-full bg-[#0a0b0e] text-white overflow-hidden font-sans">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={currentSession.id}
        onSwitchSession={switchSession}
        onCreateNewChat={createNewChat}
        onDeleteSession={deleteSession}
        onClearAll={clearAllSessions}
        onUpdateSettings={updateSettings}
        onFactoryReset={factoryReset}
        settings={settings}
        usage={usage}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 flex flex-col min-w-0 relative h-full">
        {/* Loading Overlay */}
        {authLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0a0b0e]">
             <div className="w-6 h-6 border-2 border-[#a3b8d4] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Minimal Header Controls */}
        <div className="flex items-center justify-between px-4 py-3 z-30 shrink-0">
            <div className="flex items-center gap-2">
              <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 bg-[#13141a] border border-white/5 rounded-xl md:hidden"
                  onClick={() => setSidebarOpen(true)}
              >
                  <Menu size={18} className="text-[#a3b8d4]" />
              </Button>
              
              {currentSession.messages.length > 0 && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 px-3 bg-[#13141a] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#a3b8d4] hover:text-white transition-all group"
                    onClick={(e) => {
                      const chatLog = currentSession.messages
                        .map(m => `${m.role === 'user' ? 'ПОЛЬЗОВАТЕЛЬ' : 'SMOL AGENT'}:\n${m.content}`)
                        .join('\n\n');
                      navigator.clipboard.writeText(chatLog);
                      const btn = e.currentTarget;
                      const originalText = btn.innerHTML;
                      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check mr-2"><polyline points="20 6 9 17 4 12"></polyline></svg>Скопировано';
                      setTimeout(() => { btn.innerHTML = originalText; }, 2000);
                    }}
                >
                    <Copy size={14} className="mr-2 group-hover:scale-110 transition-transform" />
                    Скопировать лог
                </Button>
              )}
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 shadow-lg">
                <Github size={14} />
                {user.photo_url && (
                  <img src={user.photo_url} alt="avatar" className="w-5 h-5 rounded-full border border-green-500/30" />
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-green-500/80">
                    GitHub Connected
                  </span>
                  <span className="text-[10px] font-bold leading-tight truncate max-w-[80px] sm:max-w-[120px]">
                     @{user.githubUsername || user.username}
                  </span>
                </div>
              </div>
            ) : (
              <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 px-3 bg-[#13141a] border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#a3b8d4] hover:text-white transition-all group"
                  onClick={login}
              >
                  <Github size={14} className="mr-2" />
                  Войти
              </Button>
            )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div className="max-w-2xl mx-auto px-4 pb-10">
              
              {currentSession.messages.length === 0 ? (
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
                      <button
                        key={i}
                        onClick={() => sendMessage(item.text)}
                        className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#13141a] border border-white/5 hover:border-[#a3b8d4]/30 transition-all text-left group"
                      >
                        <span className="text-lg opacity-70 group-hover:opacity-100">{item.icon}</span>
                        <span className="text-sm font-medium text-white/60 group-hover:text-white">{item.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {currentSession.messages.filter(m => !m.isHidden).map((message, i, arr) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      isLast={i === arr.length - 1}
                      onSend={sendMessage}
                      onRetry={message.role === "assistant" ? retryLastMessage : undefined}
                    />
                  ))}
                  
                  {isGenerating && (
                    <div className="flex items-center gap-3 py-4 text-[#a3b8d4] animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce" />
                      <span className="text-[11px] font-bold uppercase tracking-tighter">{generationStep || 'Создаю...'}</span>
                    </div>
                  )}


                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Input area - Aligned with SmolGame navigation height */}
        <div className="px-4 py-4 md:px-8 md:py-6 bg-[#0a0b0e] border-t border-white/5 shrink-0">
          <div className="max-w-2xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isGenerating={isGenerating}
              disabled={!settings.keys[settings.primaryProvider]}
              placeholder={!settings.keys[settings.primaryProvider] ? "Введите API ключи в настройках" : "Опишите игру..."}
            />
            <div className="mt-3 text-[9px] text-center text-white/10 uppercase tracking-[0.2em] font-black">
              Agent 3.0 • Entirely in browser
            </div>
          </div>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
}
