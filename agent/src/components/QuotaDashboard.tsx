import type { APIProvider } from "@/types/chat";
import { pool } from "@/lib/llm-api";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";

interface QuotaDashboardProps {
  usage: {
    requests: Record<string, number>;
  };
  keys: Partial<Record<APIProvider, string>>;
}

const PROVIDER_LIMITS: Record<string, number> = {
  groq: 14400,
  gemini: 1500,
  together: 1000,
  sambanova: 5000,
  glhf: 1000,
  openrouter: 1000,
  huggingface: 100,
};

export function QuotaDashboard({ usage, keys }: QuotaDashboardProps) {
  const providers: APIProvider[] = ["groq", "gemini", "together", "sambanova", "glhf", "openrouter", "huggingface"];

  return (
    <div className="grid grid-cols-2 gap-2 p-1">
      {providers.map((p) => {
        const hasKey = !!keys[p];
        const count = usage.requests[p] || 0;
        const limit = PROVIDER_LIMITS[p] || 1000;
        const status = pool.getStatus(p);
        const percent = Math.min(100, (count / limit) * 100);

        let colorClass = "bg-green-500/20 text-green-400 border-green-500/20";
        if (!hasKey) colorClass = "bg-white/5 text-white/30 border-white/5";
        else if (status.state === "OPEN") colorClass = "bg-red-500/20 text-red-400 border-red-500/20";
        else if (percent > 80) colorClass = "bg-yellow-500/20 text-yellow-400 border-yellow-500/20";

        return (
          <div 
            key={p} 
            className={`flex flex-col p-2 rounded-xl border transition-all ${colorClass}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-black uppercase tracking-tighter">{p}</span>
              {status.state === "OPEN" ? (
                <AlertCircle size={10} />
              ) : hasKey ? (
                <CheckCircle2 size={10} />
              ) : (
                <Zap size={10} className="opacity-20" />
              )}
            </div>
            
            <div className="h-1 w-full bg-black/20 rounded-full overflow-hidden">
              <div 
                className={`h-full transition-all duration-500 ${status.state === "OPEN" ? 'bg-red-500' : 'bg-current'}`}
                style={{ width: `${hasKey ? percent : 0}%` }}
              />
            </div>
            
            <div className="flex justify-between items-center mt-1 text-[8px] font-bold opacity-60">
              <span>{hasKey ? status.state : "NO KEY"}</span>
              <span>{count} req</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
