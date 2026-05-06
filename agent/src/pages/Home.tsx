import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessageItem } from "@/components/ChatMessageItem";
import { ChatInput } from "@/components/ChatInput";
import { ChatSidebar } from "@/components/ChatSidebar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Menu, Sparkles, ShieldCheck } from "lucide-react";
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
        <div className="flex flex-col items-center justify-center h-screen p-6 text-center bg-background">
          <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-6 max-w-md">{this.state.error?.message || "Unknown error"}</p>
          <Button onClick={() => window.location.reload()}>Reload Page</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function Home() {
  const {
    sessions,
    currentSession,
    activeSessionId,
    sendMessage,
    switchSession,
    createNewChat,
    deleteSession,
    clearAllSessions,
    factoryReset,
    retryLastMessage,
    stopGeneration,
    isGenerating,
    settings,
    updateSettings,
    usage,
    generationStep,
  } = useChat();

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!bottomRef.current || !scrollRef.current) return;
    
    const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
    if (!scrollContainer) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;

    if (isAtBottom || (currentSession.messages.length > 0 && currentSession.messages[currentSession.messages.length - 1].role === 'user')) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentSession.messages, isGenerating]);

  // Auto-clean old "API Key not found" messages if user has now seen the UI
  useEffect(() => {
    if (currentSession.messages.some(m => m.content.includes("API-ключ не найден"))) {
       // Optional: we could auto-clear, but it might be intrusive. 
       // For now, let's just make sure the activation card is visible.
    }
  }, [currentSession.messages]);

  return (
    <ErrorBoundary>
      <div className="flex h-full bg-background overflow-hidden">
      <ChatSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
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
        {/* Auth loading state */}
        {authLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}

        {/* Floating Auth Badge (Minimal) */}
        <div className="absolute top-4 right-4 z-30 flex items-center gap-2">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-background/80 border border-border backdrop-blur-md shadow-lg">
                <div className={`w-1.5 h-1.5 rounded-full ${user.isGithubConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-[9px] font-black uppercase tracking-wider text-foreground/70">
                   {user.isGithubConnected ? `@${user.githubUsername}` : 'Git Required'}
                </span>
              </div>
            ) : null}
            
            <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 md:hidden bg-background/80 backdrop-blur-md rounded-full border border-border shadow-lg"
                onClick={() => setSidebarOpen(true)}
            >
                <Menu size={16} />
            </Button>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          <ScrollArea className="flex-1" ref={scrollRef}>
            <div className="max-w-3xl mx-auto min-h-full flex flex-col">
              {currentSession.messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 px-4 py-20">
                  <div className="w-24 h-24 rounded-[40px] bg-primary/10 flex items-center justify-center mb-10 shadow-inner group transition-transform hover:rotate-6 duration-500">
                    <Sparkles className="w-12 h-12 text-primary group-hover:scale-110 transition-transform" />
                  </div>
                  
                  <div className="text-center mb-12">
                    <h2 className="text-4xl font-black text-foreground mb-4 tracking-tighter">
                      Smol-agent <span className="text-primary">AI</span>
                    </h2>
                    <p className="text-muted-foreground text-sm max-w-sm mx-auto leading-relaxed opacity-60">
                      Создавай полноценные игры за минуты. Опиши идею — агент сделает остальное.
                    </p>
                  </div>

                  <div className="w-full max-w-md bg-secondary/20 border border-border/40 rounded-[32px] p-8 mb-12">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-8">План действий</h3>
                    <div className="space-y-6">
                      {[
                        "Опиши идею игры и сеттинг",
                        "Обсуди механику «фишки» с ботом",
                        "Утверди архитектуру и протоколы",
                        "Нажми «Создать игру»",
                      ].map((text, i) => (
                        <div key={i} className="flex gap-5 items-center group">
                          <div className="w-8 h-8 rounded-2xl bg-primary/10 flex items-center justify-center text-xs font-black text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
                            {i + 1}
                          </div>
                          <span className="text-sm text-foreground/80 font-semibold group-hover:text-foreground transition-colors">{text}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 w-full max-w-md">
                    {[
                      { icon: "🚀", text: "Придумай идею для моей первой игры" },
                      { icon: "🐱", text: "Сделай игру про кота-путешественника" },
                    ].map((item, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(item.text)}
                        className="flex items-center gap-5 p-6 rounded-[24px] bg-background border border-border/50 hover:border-primary/40 hover:bg-secondary/20 transition-all text-left group shadow-sm"
                      >
                        <span className="text-2xl group-hover:scale-125 transition-transform duration-500">{item.icon}</span>
                        <span className="text-sm font-bold text-foreground/70 group-hover:text-foreground">{item.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="pb-12 pt-16">
                  {currentSession.messages.map((message) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      onRetry={
                        message.role === "assistant" && !message.isStreaming
                          ? retryLastMessage
                          : undefined
                      }
                    />
                  ))}
                  {isGenerating && generationStep && (
                    <div className="flex items-center gap-3 px-6 py-4 mx-6 mb-8 bg-primary/5 border border-primary/10 rounded-[20px] text-[11px] font-black text-primary uppercase tracking-wider animate-in fade-in slide-in-from-left-4">
                      <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
                      <span>{generationStep}</span>
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Persistent API Key Activation Overlay */}
          {!settings.apiKey && (
            <div className="absolute inset-x-0 bottom-[120px] px-4 z-40 pointer-events-none">
              <div className="max-w-md mx-auto pointer-events-auto animate-in fade-in slide-in-from-bottom-10 duration-700">
                <div className="bg-primary/10 border border-primary/30 rounded-[32px] p-6 backdrop-blur-2xl shadow-2xl ring-1 ring-white/10">
                  <div className="flex items-center gap-4 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center text-white shadow-lg shadow-primary/30">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-primary uppercase tracking-widest">Активация системы</h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Требуется API-ключ для работы</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <input 
                      type="password"
                      placeholder="OpenRouter Key (sk-or-v1-...)"
                      className="w-full bg-background/80 border border-primary/20 rounded-[18px] px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all placeholder:opacity-30"
                      value={settings.apiKey}
                      onChange={(e) => updateSettings({ apiKey: e.target.value })}
                    />
                    <div className="flex items-center justify-between px-1">
                       <a href="https://openrouter.ai/keys" target="_blank" className="text-[9px] text-primary hover:underline font-bold">Получить ключ</a>
                       <p className="text-[9px] text-muted-foreground/60 italic">Ключ не покидает ваш телефон</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input area - Non-fixed for better flow in Telegram */}
        <div className="p-4 bg-background/50 backdrop-blur-sm border-t border-border/40 shrink-0">
          <div className="max-w-3xl mx-auto">
            <ChatInput
              onSend={sendMessage}
              onStop={stopGeneration}
              isGenerating={isGenerating}
              disabled={!settings.apiKey}
              placeholder={!settings.apiKey ? "Сначала активируйте ключ ↑" : "Опишите вашу игру..."}
            />
            <div className="mt-4 flex items-center justify-center gap-4 opacity-10">
               <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-border" />
               <p className="text-[8px] uppercase tracking-[0.4em] font-black">OpenSmolGame Agent 3.0</p>
               <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-border" />
            </div>
          </div>
        </div>
      </main>
    </div>
    </ErrorBoundary>
  );
}
