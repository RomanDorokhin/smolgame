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
Your goal: Solve the task by applying precise, verified code transformations.

CURRENT PLAN:
${this.plan.length === 0 ? 'No plan yet. Create one in your first "thought".' : this.plan.map((p, i) => `${i+1}. [${p.status}] ${p.task}`).join('\n')}

ENGINEERING PRINCIPLES:
1. PLANNING: Always maintain and update your PLAN.
2. SEMANTIC PATCHING: Use PATCH_CODE/REWRITE_FUNCTION for precise changes. Avoid REPLACE_BLOCK due to its fragility.
3. REAL VALIDATION: Use VALIDATE_RUNTIME to test interaction.
4. ZERO TOLERANCE: If a button doesn't work in Playwright, your task is NOT done.

TOOLS:
- PATCH_CODE: Replace an AST node (FunctionDeclaration or ObjectProperty). Use this for semantic fixes.
- REWRITE_FUNCTION: Replace a whole function body by its name.
- UPDATE_PLAN: { newPlan: [{ task: string, status: 'pending'|'completed'|'failed' }] }
- VALIDATE_RUNTIME: Runs code in Playwright (Headless Chrome). CLICKS 'START' BUTTON.
- RESEARCH: { query: string }
- FINISH: Signal task completion with a brief summary.

CONTEXT:
${getRelevantKnowledge(['juice', 'logic', 'physics', 'mobile'])}

GLOBALS (DO NOT REDEFINE): smolState, score, hi, shake, W, H, ctx, scale, cam, joy, swipe, Part.
CORE FUNCTIONS: checkAABB(a, b), checkCircle(a, b), applyShake(v), burst(x, y, c, n), smolTriggerGameOver().

HISTORY:
${this.history.slice(-5).map((s, i) => `[Step ${i}] Action: ${s.action.type} | Observation: ${s.observation.slice(0, 100)}...`).join('\n')}

INSTRUCTIONS:
1. Output ONLY a valid JSON object.
2. Always reflect on your PLAN in your "thought".
3. If validation fails, update the PLAN to fix it.

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

      // Automatic Validation Loop
      const validation = validateCode(this.currentCode);
      if (!validation.ok) {
        return `ERROR: Last change introduced a SYNTAX ERROR: ${validation.error}. PLEASE FIX IMMEDIATELY.`;
      }

      return result;
    } catch (e) {
      return `ERROR: Tool execution failed: ${(e as Error).message}`;
    }
  }
}

