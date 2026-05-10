import { useState, useCallback, useRef } from "react";
import { generateStream } from "@/lib/llm-api";
import { SmolGameAPI } from "@/lib/smolgame-api";
import { analyzeGameCode } from "@/lib/game-code-analyzer";
import { INTERVIEWER_PROMPT, ENGINEER_PROMPT, QA_PROMPT } from "./agent_prompts";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  gameCode?: string;
  timestamp: number;
  isStreaming?: boolean;
}

export function useGameAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generateGame = useCallback(async (userPrompt: string, history: AgentMessage[] = []) => {
    setIsGenerating(true);
    const newId = Math.random().toString(36).substring(7);
    
    try {
      // 1. PLANNING PHASE
      let plan = "";
      await generateStream({
        prompt: userPrompt,
        systemPrompt: INTERVIEWER_PROMPT,
        onChunk: (chunk) => { plan += chunk; }
      });

      // 2. ENGINEERING PHASE (GOD MODE)
      let gameCode = "";
      const previousCode = history.find(m => m.gameCode)?.gameCode;
      
      const engineeringContext = previousCode 
        ? `PLAN: ${plan}\n\nEXISTING CODE TO MODIFY:\n${previousCode}\n\nUSER REQUEST: ${userPrompt}`
        : `PLAN: ${plan}\n\nUSER REQUEST: ${userPrompt}`;

      await generateStream({
        prompt: engineeringContext,
        systemPrompt: ENGINEER_PROMPT,
        onChunk: (chunk) => { gameCode += chunk; }
      });

      // 3. BRUTAL QA VALIDATION
      const analysis = analyzeGameCode(gameCode);
      
      if (analysis.juiceScore < 85 || !analysis.passed) {
        console.warn("Quality too low (Juice: " + analysis.juiceScore + "). Forcing REWRITE...");
        
        let fixedCode = "";
        const qaFeedback = `The generated code is too basic (Juice Score: ${analysis.juiceScore}/100).
        MISSING ELEMENTS: ${analysis.issues.map(i => i.message).join(", ")}.
        TASK: Rewrite the code. Add parallax, particles, screen shake, and neon glow. Make it look professional like NEON RUN.`;

        await generateStream({
          prompt: qaFeedback + "\n\nFAILED CODE:\n" + gameCode,
          systemPrompt: QA_PROMPT,
          onChunk: (chunk) => { fixedCode += chunk; }
        });
        
        if (fixedCode.includes("<game_spec>")) {
          gameCode = fixedCode;
        }
      }

      // Finalize
      const finalCode = gameCode.match(/<game_spec>([\s\S]*?)<\/game_spec>/)?.[1] || gameCode;
      return finalCode;

    } catch (error) {
      console.error("Generation failed:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { messages, isGenerating, generateGame };
}
