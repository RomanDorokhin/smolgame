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
  RotateCcw,
  Github,
  LogOut,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import type { ChatSession, ChatSettings, UsageStats, APIProvider } from "@/types/chat";
import { QuotaDashboard } from "./QuotaDashboard";

interface ChatSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSwitchSession: (id: string) => void;
  onCreateNewChat: () => void;
  onDeleteSession: (id: string) => void;
  onClearAll: () => void;
  isOpen: boolean;
  onClose: () => void;
  settings: ChatSettings;
  onUpdateSettings: (settings: Partial<ChatSettings>) => void;
  onFactoryReset: () => void;
  usage: UsageStats;
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
  const [expandedProvider, setExpandedProvider] = useState<APIProvider | null>("groq");
  const { user, isAuthenticated, login, logout } = useAuth();

  const providers: APIProvider[] = ["groq", "gemini", "deepseek", "mistral", "openrouter"];

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
        className={`fixed md:static inset-y-0 left-0 z-50 w-72 bg-[#0d0e12] border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-in-out shadow-2xl ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border shrink-0 bg-[#0d0e12]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
               <Settings className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white leading-none">Architect</h2>
              <p className="text-[10px] text-white/50 mt-1 uppercase tracking-wider font-semibold">Orchestrator v3</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 md:hidden text-white/70 hover:text-white"
            onClick={onClose}
          >
            <X size={16} />
          </Button>
        </div>

        <div className="p-3 space-y-2 shrink-0 bg-[#0d0e12]">
          <Button
            onClick={() => {
              onCreateNewChat();
              onClose();
            }}
            className="w-full justify-start gap-2 shadow-md font-bold uppercase tracking-tighter text-xs"
            variant="default"
          >
            <Plus size={16} />
            New Project
          </Button>
          
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            className={`w-full justify-start gap-2 text-xs h-9 transition-all border-white/10 ${showSettings ? 'bg-primary/20 border-primary/40 text-white' : 'text-white/60'}`}
          >
            <Settings size={14} />
            {showSettings ? "Back to Projects" : "API Orchestrator"}
          </Button>
        </div>

        <ScrollArea className="flex-1 px-3 bg-[#0d0e12]">
          {showSettings ? (
            <div className="space-y-4 py-2 pb-10">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-primary">Auto-Failover</label>
                  <input 
                    type="checkbox" 
                    checked={settings.autoFailover}
                    onChange={(e) => onUpdateSettings({ autoFailover: e.target.checked })}
                    className="w-4 h-4 rounded border-white/20 bg-black/50 accent-primary"
                  />
                </div>
                <p className="text-[9px] text-white/40 leading-tight">
                  If primary provider fails, automatically switch to the next one in the tiered order.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-white/30 ml-1">Providers & Keys</label>
                {providers.map((p) => (
                  <div key={p} className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.03]">
                    <button 
                      onClick={() => setExpandedProvider(expandedProvider === p ? null : p)}
                      className={`w-full flex items-center justify-between p-3 hover:bg-white/[0.05] transition-all ${expandedProvider === p ? 'bg-white/[0.05]' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${settings.keys[p] ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)]' : 'bg-white/10'}`} />
                        <span className={`text-[11px] font-bold uppercase tracking-tighter ${settings.primaryProvider === p ? 'text-primary' : 'text-white/80'}`}>
                          {p} {settings.primaryProvider === p && "(Primary)"}
                        </span>
                      </div>
                      {expandedProvider === p ? <ChevronUp size={14} className="text-white/40" /> : <ChevronDown size={14} className="text-white/40" />}
                    </button>
                    
                    {expandedProvider === p && (
                      <div className="p-3 pt-0 space-y-3 bg-white/[0.02]">
                        <Input
                          type="password"
                          placeholder={`${p} API key`}
                          value={settings.keys[p] || ""}
                          onChange={(e) => {
                            const newKeys = { ...settings.keys, [p]: e.target.value };
                            onUpdateSettings({ keys: newKeys });
                          }}
                          className="h-9 text-xs bg-black/40 border-white/10 text-white placeholder:text-white/20 focus:border-primary/50"
                        />
                        <div className="flex gap-1">
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            className="flex-1 h-7 text-[9px] font-bold uppercase tracking-tighter bg-white/10 hover:bg-white/20 text-white"
                            onClick={() => onUpdateSettings({ primaryProvider: p })}
                            disabled={settings.primaryProvider === p}
                          >
                            Set as Primary
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-sidebar-border mt-4">
                <label className="text-[10px] font-black uppercase text-sidebar-foreground/40 ml-1">Account</label>
                {isAuthenticated && user ? (
                  <div className="flex flex-col gap-2 mt-2 px-1">
                    <div className="flex items-center gap-2">
                      {user.photo_url && (
                        <img src={user.photo_url} alt="avatar" className="w-6 h-6 rounded-full border border-sidebar-border" />
                      )}
                      <span className="text-xs font-bold truncate">@{user.githubUsername || user.username}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="w-full justify-start gap-2 text-[10px] h-8 font-bold uppercase tracking-tighter"
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
                      className="w-full justify-start gap-2 text-[10px] h-8 bg-[#24292f] hover:bg-[#24292f]/80 text-white font-bold uppercase tracking-tighter"
                    >
                      <Github size={12} />
                      Login with GitHub
                    </Button>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-sidebar-border mt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onFactoryReset}
                  className="w-full justify-start gap-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 h-8 font-bold uppercase tracking-tighter"
                >
                  <RotateCcw size={14} />
                  Factory Reset
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1 py-2">
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-20">
                   <MessageSquare size={32} />
                   <p className="text-xs mt-2 font-bold uppercase">Empty Workspace</p>
                </div>
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
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all group relative overflow-hidden ${
                      activeSessionId === session.id
                        ? "bg-primary/10 text-primary border border-primary/20 shadow-sm"
                        : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80 border border-transparent"
                    }`}
                  >
                    <MessageSquare size={16} className={`flex-shrink-0 ${activeSessionId === session.id ? 'text-primary' : 'opacity-40'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate leading-none mb-1">{session.title}</p>
                      <div className="flex items-center gap-2">
                         <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">
                            {new Date(session.updatedAt).toLocaleDateString()}
                         </span>
                         {session.retryCount && (
                           <span className="text-[8px] px-1 bg-yellow-500/20 text-yellow-500 rounded font-black">FAILOVER: {session.retryCount}</span>
                         )}
                      </div>
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
                        <Trash2 size={14} className="text-destructive opacity-40 hover:opacity-100" />
                      </Button>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-3 border-t border-sidebar-border bg-sidebar-accent/5 shrink-0">
          <div className="mb-2 px-1 flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-sidebar-foreground/40">Quota Stats</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={`h-5 px-2 text-[8px] font-black uppercase tracking-tighter ${
                confirmClear ? "text-destructive" : "text-sidebar-foreground/20 hover:text-sidebar-foreground"
              }`}
            >
              {confirmClear ? "Clear All History?" : "Clear history"}
            </Button>
          </div>
          
          <QuotaDashboard usage={usage} keys={settings.keys} />
          
          <div className="mt-3 px-1 text-[8px] text-center font-black uppercase tracking-[0.3em] opacity-20">
            Engine: Hybrid v2.6.4
          </div>
        </div>
      </aside>
    </>
  );
}

