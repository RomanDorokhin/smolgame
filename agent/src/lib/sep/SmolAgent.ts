import { LLMConfig, generateStream } from "../llm-api";
import { analyzeGameJS, replaceFunctionInCode, validateCode, replaceNodeInCode } from "./ast-analyzer";
import { getRelevantKnowledge } from "../knowledge-base";
import { z } from "zod";

const AgentActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("REPLACE_BLOCK"),
    search: z.string(),
    replace: z.string()
  }),
  z.object({
    type: z.literal("REWRITE_FUNCTION"),
    name: z.string(),
    code: z.string()
  }),
  z.object({
    type: z.literal("PATCH_CODE"),
    nodeType: z.enum(["FunctionDeclaration", "ObjectProperty"]),
    name: z.string(),
    code: z.string()
  }),
  z.object({
    type: z.literal("VALIDATE_RUNTIME"),
  }),
  z.object({
    type: z.literal("RESEARCH"),
    query: z.string()
  }),
  z.object({
    type: z.literal("UPDATE_PLAN"),
    newPlan: z.array(z.object({
      task: z.string(),
      status: z.enum(["pending", "completed", "failed"])
    }))
  }),
  z.object({
    type: z.literal("FINISH"),
    reason: z.string()
  })
]);

const AgentResponseSchema = z.object({
  thought: z.string(),
  action: AgentActionSchema
});

export type AgentAction = z.infer<typeof AgentActionSchema>;

export interface PlanStep {
  task: string;
  status: 'pending' | 'completed' | 'failed';
}

export interface AgentHistoryStep {
  thought: string;
  action: AgentAction;
  observation: string;
  codeSnapshot?: string;
  metrics?: {
    tokens?: number;
    duration?: number;
  };
}

export interface SmolAgentConfig {
  llm: LLMConfig;
  onProgress: (msg: string) => void;
  signal?: AbortSignal;
}

export class SmolAgent {
  private history: AgentHistoryStep[] = [];
  private plan: PlanStep[] = [];
  private currentCode: string = "";
  private config: SmolAgentConfig;

  constructor(config: SmolAgentConfig) {
    this.config = config;
  }

  async runFixLoop(task: string, initialCode: string, runtimeError?: string): Promise<string> {
    this.currentCode = initialCode;
    const maxIterations = 15; // Increased for complex tasks
    
    for (let i = 0; i < maxIterations; i++) {
      this.config.onProgress(`⚙️ Инженерная итерация ${i + 1}/${maxIterations}...`);
      
      const startTime = Date.now();
      const step = await this.executeStep(task, runtimeError);
      step.metrics = { duration: Date.now() - startTime };
      
      this.history.push(step);
      
      if (step.action.type === 'FINISH') {
        this.config.onProgress(`🏁 Завершено: ${step.action.reason}`);
        break;
      }

      if (step.observation.startsWith('ERROR')) {
         this.config.onProgress(`❌ Провал: ${step.observation.slice(0, 100)}...`);
      } else {
         this.config.onProgress(`🛠 Применено: ${step.observation.slice(0, 50)}...`);
      }
    }

    return this.currentCode;
  }

  private async executeStep(task: string, runtimeError?: string): Promise<AgentHistoryStep> {
    const systemPrompt = `You are a World-Class Autonomous Game Engineer (ENGINEER-1).
Your goal: Build high-performance, polished, and 'juicy' web games by applying precise, verified code transformations.

CURRENT PLAN:
${this.plan.length === 0 ? 'No plan yet. Create one in your first "thought".' : this.plan.map((p, i) => `${i+1}. [${p.status}] ${p.task}`).join('\n')}

HARD ENGINEERING RULES (VIOLATION = FAILURE):
1. NO DUPLICATION: Never re-implement helper functions (checkAABB, burst, etc.) or classes (Particle). They are already in the ENGINE CORE.
2. NO SHIZOPHRENIA: Use the existing CSS variables in :root. Do NOT add new style blocks or conflicting :root definitions.
3. USE CONFIG: Update the 'CONFIG' object for game settings (pixelated, joyEnabled, gravity).
4. MODULARITY: Keep your game logic in 'init()', 'update()', and 'draw()'.
5. ZERO TOLERANCE: If validation fails or code crashes, you MUST fix it immediately.
6. NO PROXIES: Do not use Proxy or 'Compatibility Layers'. Write clean, direct code.

ENGINE CORE API (DO NOT REDEFINE):
- GLOBALS: smolState ('start'|'play'|'over'), score, hi, W, H, ctx, scale, cam (x, y, zoom), joy (x, y), swipe (up, down, left, right).
- ARRAYS: entities (your game objects), particles (managed automatically).
- CLASSES: Particle(x, y, color, size, vx, vy).
- FUNCTIONS: 
    * checkAABB(a, b), checkCircle(a, b)
    * applyShake(v) - screen shake
    * burst(x, y, color, n) - spawn particles
    * smolTriggerGameOver() - call this on death
    * sfx(freq, duration, type, sweep) - play sound

TOOLS:
- PATCH_CODE: Replace an AST node (FunctionDeclaration or ObjectProperty). Use this for semantic fixes.
- REWRITE_FUNCTION: Replace a whole function body by its name.
- UPDATE_PLAN: { newPlan: [{ task: string, status: 'pending'|'completed'|'failed' }] }
- VALIDATE_RUNTIME: Runs code in Playwright (Headless Chrome).
- RESEARCH: { query: string }
- FINISH: Signal task completion with a brief summary.

CONTEXT:
${getRelevantKnowledge(['juice', 'logic', 'physics', 'mobile'])}

HISTORY (LAST 5 STEPS):
${this.history.slice(-5).map((s, i) => `[Step ${i}] Action: ${s.action.type} | Observation: ${s.observation.slice(0, 100)}...`).join('\n')}

INSTRUCTIONS:
1. Output ONLY a valid JSON object.
2. Always reflect on your PLAN in your "thought".
3. Use 'PATCH_CODE' or 'REWRITE_FUNCTION' whenever possible to maintain code integrity.

OUTPUT:
{
  "thought": "Deep engineering analysis...",
  "action": { "type": "TOOL_NAME", ...params }
}`;

    let fullResponse = "";
    const msgs = [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: task }
    ];
    
    try {
      const stream = generateStream(msgs, this.config.llm, this.config.signal);
      for await (const chunk of stream) {
        fullResponse += chunk;
      }

      // Robust JSON extraction
      const jsonStartIndex = fullResponse.indexOf('{');
      const jsonEndIndex = fullResponse.lastIndexOf('}');
      if (jsonStartIndex === -1 || jsonEndIndex === -1) {
        throw new Error("LLM failed to output valid JSON. No curly braces found.");
      }
      const jsonString = fullResponse.substring(jsonStartIndex, jsonEndIndex + 1);
      
      const parsed = AgentResponseSchema.parse(JSON.parse(jsonString));
      const observation = await this.performAction(parsed.action);

      return {
        thought: parsed.thought,
        action: parsed.action,
        observation,
        codeSnapshot: this.currentCode
      };
    } catch (e) {
      return {
        thought: "Internal parsing error",
        action: { type: "FINISH", reason: "Error" },
        observation: `CRITICAL ERROR: ${(e as Error).message}`
      };
    }
  }

  private async performAction(action: AgentAction): Promise<string> {
    try {
      let result = "";
      switch (action.type) {
        case 'REPLACE_BLOCK': {
           if (!this.currentCode.includes(action.search)) return "ERROR: Search text not found.";
           this.currentCode = this.currentCode.replace(action.search, action.replace);
           result = "SUCCESS: Block replaced.";
           break;
        }
        case 'REWRITE_FUNCTION': {
           const newCode = replaceFunctionInCode(this.currentCode, action.name, action.code);
           if (newCode === this.currentCode) return `ERROR: Function ${action.name} not found or AST failed.`;
           this.currentCode = newCode;
           result = `SUCCESS: Function ${action.name} rewritten.`;
           break;
        }
        case 'PATCH_CODE': {
           const newCode = replaceNodeInCode(this.currentCode, action.nodeType, 'name', action.name, action.code);
           if (newCode === this.currentCode) return `ERROR: Node ${action.name} of type ${action.nodeType} not found.`;
           this.currentCode = newCode;
           result = `SUCCESS: Node ${action.name} patched.`;
           break;
        }
        case 'VALIDATE': {
           const analysis = analyzeGameJS(this.currentCode);
           return `ANALYSIS: Score ${analysis.score}/100. Errors: ${analysis.errors.join(', ')}. Features: ${analysis.features.join(', ')}`;
        }
        case 'VALIDATE_RUNTIME': {
            try {
              const response = await fetch('http://localhost:3001/api/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: this.currentCode })
              });
              const result = await response.json();
              if (result.ok) {
                return "RUNTIME SUCCESS: Playwright verified the 'START' button and found no console errors.";
              } else {
                return `RUNTIME FAILURE (Playwright):\n${result.errors.join('\n')}`;
              }
            } catch (e: any) {
              return `ERROR: Could not connect to Playwright Validation Server: ${e.message}`;
            }
        }
        case 'UPDATE_PLAN': {
            this.plan = action.newPlan;
            return `SUCCESS: Plan updated to ${this.plan.length} steps.`;
        }
        case 'FINISH':
           return "DONE";
      }

      // Automatic Verification Loop
      let finalObservation = result;

      // 1. Static AST Analysis
      const analysis = analyzeGameJS(this.currentCode);
      if (analysis.errors.length > 0) {
        return `CRITICAL ERROR (AST): ${analysis.errors.join('\n')}. PLEASE FIX IMMEDIATELY.`;
      }

      // 2. Automatic Runtime Validation (Only for code changes)
      if (action.type === 'REPLACE_BLOCK' || action.type === 'REWRITE_FUNCTION' || action.type === 'PATCH_CODE') {
        this.config.onProgress(`🔍 Автоматическая проверка рантайма...`);
        try {
          const response = await fetch('http://localhost:3001/api/validate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html: this.currentCode })
          });
          const valResult = await response.json();
          if (!valResult.ok) {
            finalObservation = `ERROR (RUNTIME):\n${valResult.errors.join('\n')}\n\nYour last change broke the game. Analyze the errors and fix them in the next step.`;
          } else {
             finalObservation += `\nRUNTIME VERIFIED: No errors found. Score: ${analysis.score}/100.`;
          }
        } catch (e: any) {
          finalObservation += `\nWARNING: Runtime validation skipped (server unreachable: ${e.message})`;
        }
      }

      return finalObservation;
    } catch (e) {
      return `ERROR: Tool execution failed: ${(e as Error).message}`;
    }
  }
}

