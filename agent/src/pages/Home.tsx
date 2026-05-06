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

  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
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
            <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 bg-[#13141a] border border-white/5 rounded-xl md:hidden"
                onClick={() => setSidebarOpen(true)}
            >
                <Menu size={18} className="text-[#a3b8d4]" />
            </Button>

            {isAuthenticated && user && (
              <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-[#13141a] border border-white/5 shadow-lg">
                {user.photo_url ? (
                  <img src={user.photo_url} alt="avatar" className="w-5 h-5 rounded-full border border-white/10" />
                ) : (
                  <div className={`w-1.5 h-1.5 rounded-full ${user.isGithubConnected ? 'bg-[#a3b8d4]' : 'bg-yellow-500'}`} />
                )}
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#a3b8d4]">
                    {user.isGithubConnected ? 'GitHub Connected' : 'Guest Mode'}
                  </span>
                  <span className="text-[10px] font-bold text-white/70 leading-tight">
                     @{user.githubUsername || user.username}
                  </span>
                </div>
              </div>
            )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div className="max-w-2xl mx-auto px-4 pb-10">
              
              {/* API Key Box - Integrated into the flow, not blocking */}
              {!settings.apiKey && (
                <div className="mb-8 p-5 bg-[#13141a] border border-white/5 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-3 mb-4">
                    <ShieldCheck size={18} className="text-[#a3b8d4]" />
                    <span className="text-xs font-bold uppercase tracking-widest text-[#a3b8d4]">Активация</span>
                  </div>
                  <input 
                    type="password"
                    placeholder="Введите OpenRouter API ключ..."
                    className="w-full bg-[#0a0b0e] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#a3b8d4]/50 transition-all text-white"
                    value={settings.apiKey}
                    onChange={(e) => updateSettings({ apiKey: e.target.value })}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <a href="https://openrouter.ai/keys" target="_blank" className="text-[10px] text-[#a3b8d4] hover:underline font-medium">Получить ключ →</a>
                    <span className="text-[9px] text-white/20">Ключ хранится только у вас</span>
                  </div>
                </div>
              )}

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
                  {currentSession.messages.filter(m => !m.isHidden).map((message) => (
                    <ChatMessageItem
                      key={message.id}
                      message={message}
                      onRetry={message.role === "assistant" ? retryLastMessage : undefined}
                    />
                  ))}
                  
                  {isGenerating && (
                    <div className="flex items-center gap-3 py-4 text-[#a3b8d4] animate-pulse">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce" />
                      <span className="text-[11px] font-bold uppercase tracking-tighter">{generationStep || 'Создаю...'}</span>
                    </div>
                  )}

                  {/* Deploy/Test Buttons */}
                  {currentSession.messages.length > 0 && 
                   currentSession.messages[currentSession.messages.length - 1].pipelineResult?.isPublishable && 
                   !isGenerating && (
                    <div className="mt-4 p-4 rounded-2xl bg-[#13141a] border border-[#a3b8d4]/30 flex flex-col gap-3 animate-in fade-in zoom-in duration-500">
                       <div className="flex items-center gap-3">
                        <ShieldCheck className="text-[#a3b8d4]" size={24} />
                        <div className="flex-1">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white">Игра готова к тесту!</h3>
                            <p className="text-[9px] text-[#a3b8d4] font-medium">Качество: 100/100 • Без ошибок</p>
                        </div>
                       </div>

                       <div className="flex gap-2">
                         <Button 
                          onClick={() => {
                            const code = currentSession.messages[currentSession.messages.length - 1].pipelineResult.generatedCode;
                            const blob = new Blob([code], { type: 'text/html' });
                            const url = URL.createObjectURL(blob);
                            window.open(url, '_blank');
                          }}
                          className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold uppercase tracking-tighter text-[10px] rounded-xl py-4 h-auto"
                         >
                           Тестировать
                         </Button>

                         <Button 
                          onClick={deployToGitHub}
                          disabled={isPipelineRunning}
                          className="flex-1 bg-[#a3b8d4] hover:bg-[#8da3c1] text-[#0a0b0e] font-black uppercase tracking-tighter text-[10px] rounded-xl py-4 h-auto shadow-[0_0_20px_rgba(163,184,212,0.2)]"
                         >
                           {isPipelineRunning ? 'Отправка...' : 'На модерацию'}
                         </Button>
                       </div>
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
              disabled={!settings.apiKey}
              placeholder={!settings.apiKey ? "Нужен API ключ ↑" : "Опишите игру..."}
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
