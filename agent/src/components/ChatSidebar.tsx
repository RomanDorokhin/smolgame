import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Plus,
  MessageSquare,
  Trash2,
  X,
  Settings,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  RotateCcw,
  Github,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ChatSession } from "@/types/chat";
import type { APIProvider } from "@/lib/llm-api";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onClose: () => void;
  settings: {
    provider: APIProvider;
    apiKey: string;
    model: string;
  };
  onUpdateSettings: (settings: any) => void;
  onFactoryReset: () => void;
  usage: {
    requests: number;
    lastReset: number;
  };
}

export function ChatSidebar({
  sessions,
  activeSessionId,
  onSwitchSession,
  onCreateNewChat,
  onDeleteSession,
  onClearAll,
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onFactoryReset,
  usage,
}: ChatSidebarProps) {
  const [confirmClear, setConfirmClear] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { user, isAuthenticated, login, logout } = useAuth();

  const handleClear = () => {
    if (confirmClear) {
      onClearAll();
      setConfirmClear(false);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
    }
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-sidebar-foreground leading-none">Smol-agent</h2>
              <p className="text-[10px] text-sidebar-foreground/50 mt-1 uppercase tracking-wider font-semibold">AI First</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="p-3 space-y-2">
          <Button
            onClick={() => {
              onCreateNewChat();
              onClose();
            }}
            className="w-full justify-start gap-2 shadow-sm"
            variant="default"
          >
            <Plus size={16} />
            New Chat
          </Button>
          
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            className="w-full justify-start gap-2 text-xs h-9"
          >
            <Settings size={14} />
            {showSettings ? "Back to Chats" : "API Settings"}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3">
          {showSettings ? (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-sidebar-foreground/50 ml-1">Provider</label>
                <select
                  value={settings.provider}
                  onChange={(e) => onUpdateSettings({ provider: e.target.value as APIProvider })}
                  className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                >
                  <option value="openrouter">OpenRouter (DeepSeek)</option>
                  <option value="groq">Groq</option>
                  <option value="gemini">Gemini</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-sidebar-foreground/50 ml-1">API Key</label>
                <Input
                  type="password"
                  placeholder="Enter your API key"
                  value={settings.apiKey}
                  onChange={(e) => onUpdateSettings({ apiKey: e.target.value })}
                  className="bg-background"
                />
                <p className="text-[10px] text-sidebar-foreground/40 px-1">
                  Stored locally in your browser. 
                  <a href="https://openrouter.ai/keys" target="_blank" className="text-primary hover:underline ml-1 inline-flex items-center gap-0.5">
                    Get key <ExternalLink size={8} />
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-bold uppercase text-sidebar-foreground/50 ml-1">Model</label>
                <Input
                  placeholder="deepseek/deepseek-chat"
                  value={settings.model}
                  onChange={(e) => onUpdateSettings({ model: e.target.value })}
                  className="bg-background"
                />
              </div>

              <div className="pt-2 border-t border-sidebar-border mt-4">
                <label className="text-[11px] font-bold uppercase text-sidebar-foreground/50 ml-1">GitHub Account</label>
                {isAuthenticated && user ? (
                  <div className="flex flex-col gap-2 mt-2 px-1">
                    <div className="flex items-center gap-2">
                      {user.photo_url && (
                        <img src={user.photo_url} alt={user.githubUsername || user.username} className="w-6 h-6 rounded-full" />
                      )}
                      <span className="text-xs font-medium">{user.githubUsername || user.username}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="w-full justify-start gap-2 text-[10px] h-8"
                    >
                      <LogOut size={12} />
                      Logout
                    </Button>
                  </div>
                ) : (
                  <div className="mt-2 px-1">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={login}
                      className="w-full justify-start gap-2 text-[10px] h-8 bg-black hover:bg-black/80 text-white"
                    >
                      <Github size={12} />
                      Login with GitHub
                    </Button>
                  </div>
                )}
                <p className="text-[9px] text-sidebar-foreground/40 px-1 mt-1">
                  Connect to GitHub for instant game deployment.
                </p>
              </div>

              <div className="pt-4 border-t border-sidebar-border mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFactoryReset}
                  className="w-full justify-start gap-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 h-8"
                >
                  <RotateCcw size={14} />
                  Reset App Cache (Hard)
                </Button>
                <p className="text-[9px] text-sidebar-foreground/30 mt-2 px-1 leading-tight">
                  This will delete ALL chats, history and API keys permanently.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {sessions.length === 0 ? (
                <p className="text-sm text-sidebar-foreground/50 text-center py-8">
                  No chats yet.
                </p>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSwitchSession(session.id);
                      onClose();
                    }}
                    onMouseEnter={() => setHoveredId(session.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors group ${
                      activeSessionId === session.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                    }`}
                  >
                    <MessageSquare size={16} className="flex-shrink-0 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{session.title}</p>
                      <p className="text-[10px] text-sidebar-foreground/40">
                        {new Date(session.updatedAt).toLocaleDateString()}
                      </p>
                    </div>
                    {(hoveredId === session.id || activeSessionId === session.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSession(session.id);
                        }}
                      >
                        <Trash2 size={14} className="text-sidebar-foreground/40 hover:text-destructive" />
                      </Button>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border space-y-3">
          <div className="flex items-center justify-between px-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={`h-7 text-[11px] ${
                confirmClear
                  ? "text-destructive hover:text-destructive bg-destructive/10"
                  : "text-sidebar-foreground/50 hover:bg-sidebar-accent"
              }`}
            >
              {confirmClear ? (
                <>
                  <AlertTriangle size={12} className="mr-1" />
                  Confirm Clear
                </>
              ) : (
                <>
                  <Trash2 size={12} className="mr-1" />
                  Clear History
                </>
              )}
            </Button>
          </div>

          <div className="px-3 py-2 bg-sidebar-accent/30 rounded-lg border border-sidebar-border/50">
            <div className="flex items-center justify-between gap-2 text-[11px] text-sidebar-foreground/60">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-1.5 h-1.5 rounded-full ${settings.apiKey ? 'bg-green-500' : 'bg-yellow-500'}`} />
                <span className="font-medium truncate">{settings.provider}: {settings.model}</span>
              </div>
              <span className="shrink-0 opacity-80">{usage.requests}/50</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

