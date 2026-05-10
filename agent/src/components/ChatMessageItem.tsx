import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check, User, Bot, Play, X, Github, Loader2, Clock, ExternalLink } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { AgentMessage } from "@/hooks/useGameAgent";
import { useAuth } from "@/_core/hooks/useAuth";
import { SmolGameAPI } from "@/lib/smolgame-api";

interface ChatMessageItemProps {
  message: AgentMessage;
  onRetry?: () => void;
  onSend?: (content: string) => void;
  onSwitchTab?: (tab: "chat" | "studio") => void;
  onLoadStudio?: (title: string, code: string) => void;
  isLast?: boolean;
}

const extractTextFromNode = (node: any): string => {
  if (!node) return "";
  if (node.type === "text") return node.value || "";
  if (node.children) return node.children.map(extractTextFromNode).join("");
  return "";
};

export function ChatMessageItem({ message, onSend, onSwitchTab, onLoadStudio, isLast }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const { isGithubConnected } = useAuth();

  const htmlCode = message.gameCode;
  const deployState = message.deployState || { phase: "idle" };

  useEffect(() => {
    (window as any).__smolAuthUser = { isGithubConnected };
  }, [isGithubConnected]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  return (
    <div className={`flex gap-4 py-8 px-4 ${isUser ? "bg-transparent" : "bg-[#13141a]/30"}`}>
      <div className="flex-shrink-0">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isUser ? "bg-[#1c1e26] text-white/50" : "bg-[#a3b8d4]/10 text-[#a3b8d4]"}`}>
          {isUser ? <User size={18} /> : <Bot size={18} />}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs font-black uppercase tracking-widest text-white/30">
            {isUser ? "Пользователь" : "agent-smol"}
          </span>
          <span className="text-[10px] text-white/10">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
        <div className="prose prose-invert max-w-none">
          {isUser ? (
            <p className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm font-medium">
              {message.content}
            </p>
          ) : (
            <div className="markdown-content text-white/90">
              {message.content ? (
                <>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      ul: ({ node, children, ...props }) => {
                        if (isLast && onSend) return <ul className="m-0 p-0 mt-4 mb-2 space-y-2 flex flex-col items-start w-full" {...props}>{children}</ul>;
                        return <ul className="list-disc pl-4 mt-2 mb-4 space-y-1 text-white/80" {...props}>{children}</ul>;
                      },
                      ol: ({ node, children, ...props }) => {
                        if (isLast && onSend) return <ol className="m-0 p-0 mt-4 mb-2 space-y-2 flex flex-col items-start w-full" {...props}>{children}</ol>;
                        return <ol className="list-decimal pl-4 mt-2 mb-4 space-y-1 text-white/80" {...props}>{children}</ol>;
                      },
                      li: ({ node, children, ...props }) => {
                        if (isLast && onSend) {
                          const text = extractTextFromNode(node).trim();
                          return (
                            <li className="list-none w-full" {...props}>
                              <button
                                onClick={() => onSend(text)}
                                className="text-left w-full px-4 py-3 bg-[#13141a] hover:bg-[#a3b8d4]/10 border border-white/5 hover:border-[#a3b8d4]/30 rounded-xl text-sm transition-all text-white/80 hover:text-white font-medium group flex items-center justify-between"
                              >
                                <span>{children}</span>
                                <span className="opacity-0 group-hover:opacity-100 shrink-0 text-[#a3b8d4] text-[10px] uppercase font-black tracking-widest ml-4 transition-opacity">
                                  Выбрать
                                </span>
                              </button>
                            </li>
                          );
                        }
                        return <li className="mb-1" {...props}>{children}</li>;
                      },
                    }}
                  >
                    {(() => {
                      const filtered = message.content
                        .replace(/<game_spec>[\s\S]*?(?:<\/game_spec>|$)/g, "")
                        .replace(/<thought>[\s\S]*?(?:<\/thought>|$)/g, "")
                        .replace(/<plan>[\s\S]*?(?:<\/plan>|$)/g, "")
                        .trim();
                      return filtered || message.content;
                    })()}
                  </ReactMarkdown>

                  {message.progress !== undefined && message.isStreaming && (
                    <div className="mt-6 space-y-3 p-4 bg-white/5 border border-white/5 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[#a3b8d4]">Создание игры</span>
                        <span className="text-[10px] font-black text-white">{message.progress}%</span>
                      </div>
                      <Progress value={message.progress} className="h-1.5 bg-white/5" />
                      <p className="text-[9px] text-white/30 uppercase tracking-tighter">Движок: OpenGame Core v4.3</p>
                    </div>
                  )}
                </>
              ) : isStreaming ? (
                <div className="flex items-center gap-1.5 text-[#a3b8d4]">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[#a3b8d4] animate-bounce [animation-delay:300ms]" />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {!isUser && message.content && !isStreaming && (
          <div className="flex flex-col gap-4 mt-6">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-[#a3b8d4] hover:text-white bg-[#13141a] border border-white/5 rounded-xl transition-all"
                onClick={handleCopy}
              >
                {copied ? <Check size={14} className="mr-2" /> : <Copy size={14} className="mr-2" />}
                {copied ? "Скопировано" : "Копировать"}
              </Button>
              {htmlCode && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 px-3 text-[10px] font-bold uppercase tracking-widest text-blue-400 hover:text-blue-300 bg-blue-500/5 border border-blue-500/10 rounded-xl transition-all"
                  onClick={() => {
                    if (onLoadStudio && htmlCode) {
                      onLoadStudio("Generated Game", htmlCode);
                    }
                    if (onSwitchTab) {
                      onSwitchTab("studio");
                    }
                  }}
                >
                  <Play size={14} className="mr-2" /> Студия
                </Button>
              )}
            </div>

            {deployState.phase !== "idle" && (
              <div className="bg-[#1c1e26] border border-white/5 rounded-2xl p-6 shadow-2xl">
                {deployState.phase === "ready" ? (
                  <Button
                    className="w-full h-14 bg-[#22c55e] hover:bg-[#16a34a] text-white font-black uppercase tracking-[0.3em] text-[14px] rounded-2xl gap-3 shadow-[0_12px_24px_-6px_rgba(34,197,94,0.5)] transition-all active:scale-95"
                    onClick={() => {
                      console.log("Play button clicked for message:", message.id);
                      const code = message.gameCode || message.content.match(/```html\n([\s\S]*?)```/)?.[1];
                      
                      if (code && onLoadStudio) {
                        onLoadStudio(message.id.slice(0, 8), code);
                        if (onSwitchTab) onSwitchTab("studio");
                      } else {
                        console.error("No game code found in message:", message);
                        alert("Упс! Код этой игры не найден в истории. Попробуй попросить Агента сгенерировать его еще раз или проверь раздел 'Черновики' в сайдбаре.");
                      }
                    }}
                  >
                    <Play size={22} fill="currentColor" className="ml-1" /> ИГРАТЬ
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {deployState.phase === "deploying" && (
                      <div className="flex items-center gap-3 p-3 bg-[#a3b8d4]/5 border border-[#a3b8d4]/15 rounded-xl">
                        <Loader2 size={16} className="animate-spin text-[#a3b8d4]" />
                        <span className="text-[11px] text-[#a3b8d4] font-bold">{deployState.status}</span>
                      </div>
                    )}

                    {deployState.phase === "waiting_pages" && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-amber-500/5 border border-amber-500/15 rounded-xl">
                          <Clock size={16} className="text-amber-400 animate-pulse" />
                          <div className="flex-1">
                            <p className="text-[11px] text-amber-400 font-bold">GitHub Pages активируется…</p>
                            <p className="text-[9px] text-white/30">Попытка {deployState.attempt}/{deployState.maxAttempts}</p>
                          </div>
                        </div>
                        <div className="h-1.5 w-full bg-blue-500/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 transition-all duration-700" 
                            style={{ width: `${(deployState.attempt! / deployState.maxAttempts!) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {deployState.phase === "error" && (
                      <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-[10px]">
                        <strong>Ошибка:</strong> {deployState.error}
                      </div>
                    )}

                    {(deployState.pagesUrl || deployState.repoUrl) && (
                      <div className="grid grid-cols-2 gap-2">
                        {deployState.pagesUrl && (
                          <Button 
                            variant="outline" 
                            className="h-10 text-[10px] font-black uppercase" 
                            onClick={() => {
                              if (onLoadStudio && htmlCode) {
                                onLoadStudio("Generated Game", htmlCode);
                              }
                              if (onSwitchTab) {
                                onSwitchTab("studio");
                              }
                            }}
                          >
                            <Play size={14} className="mr-2" /> Студия
                          </Button>
                        )}
                        {deployState.repoUrl && (
                          <Button variant="outline" className="h-10 text-[10px] font-black uppercase" onClick={() => window.open(deployState.repoUrl, "_blank")}>
                            <Github size={14} className="mr-2" /> Repo
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {showPreview && htmlCode && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
            <div className="relative w-full max-w-lg aspect-[9/16] bg-black rounded-[32px] overflow-hidden border border-white/10">
              <Button variant="ghost" className="absolute top-6 right-6 z-50 text-white" onClick={() => setShowPreview(false)}><X size={20} /></Button>
                <iframe
                  key={message.id + htmlCode.length}
                  title="Game Preview"
                  srcDoc={(htmlCode.includes("<!DOCTYPE") ? htmlCode : `<!DOCTYPE html><html><body style="margin:0;overflow:hidden;background:#000;">${htmlCode}</body></html>`)
                    .replace(/window\.innerWidth/g, '(window.innerWidth || 380)')
                    .replace(/window\.innerHeight/g, '(window.innerHeight || 675)')
                  }
                  className="w-full h-full border-none bg-black"
                  sandbox="allow-scripts allow-pointer-lock allow-same-origin allow-modals"
                />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
