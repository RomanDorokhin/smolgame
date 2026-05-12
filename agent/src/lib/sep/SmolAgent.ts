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
    type: z.literal("VALIDATE"),
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

export interface AgentStep {
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
  private history: AgentStep[] = [];
  private currentCode: string = "";
  private config: SmolAgentConfig;

  constructor(config: SmolAgentConfig) {
    this.config = config;
  }

  async runFixLoop(task: string, initialCode: string, runtimeError?: string): Promise<string> {
    this.currentCode = initialCode;
    const maxIterations = 7;
    
    for (let i = 0; i < maxIterations; i++) {
      this.config.onProgress(`Анализирую (итерация ${i + 1}/${maxIterations})...`);
      
      const startTime = Date.now();
      const step = await this.executeStep(task, runtimeError);
      step.metrics = { duration: Date.now() - startTime };
      
      this.history.push(step);
      
      if (step.action.type === 'FINISH') {
        this.config.onProgress(`✅ Завершено: ${step.action.reason}`);
        break;
      }

      if (step.observation.startsWith('ERROR')) {
         this.config.onProgress(`⚠️ Ошибка: ${step.observation.slice(0, 100)}...`);
      } else {
         this.config.onProgress(`✅ OK: ${step.observation.slice(0, 50)}...`);
      }
    }

    return this.currentCode;
  }

  private async executeStep(task: string, runtimeError?: string): Promise<AgentStep> {
    const systemPrompt = `You are a World-Class Autonomous AI Software Engineer specializing in Game Dev.
Your goal: Fulfill the <task> by applying precise, verified code transformations.

OPERATIONAL PROTOCOL:
1. INTERNAL MONOLOGUE: Reason deeply about the architecture and current state.
2. STRUCTURED ACTION: You MUST output a valid JSON object matching the schema.
3. ATOMICITY: Apply one logical change per step.
4. VALIDATION: Every change is automatically verified for syntax. If you break it, you must fix it.

AVAILABLE TOOLS:
- REPLACE_BLOCK: Precise string replacement (use for unique blocks).
- REWRITE_FUNCTION: Replace a whole function body by name.
- PATCH_CODE: Replace an AST node (FunctionDeclaration or ObjectProperty).
- VALIDATE: Explicitly run syntax and logic analysis.
- FINISH: Stop when the task is fully completed.

KNOWLEDGE BASE:
${getRelevantKnowledge(['juice', 'logic', 'physics', 'mobile'])}

GLOBALS: W, H, ctx, scale, score, hi, shake, cam, joy, swipe, glow, nglow, sfx, Part.

CURRENT CODE:
\`\`\`javascript
${this.currentCode}
\`\`\`

${runtimeError ? `RUNTIME ERROR FROM IFRAME:\n${runtimeError}` : ''}

HISTORY:
${this.history.map((s, i) => `[${i}] ${s.action.type}: ${s.observation}`).join('\n')}

OUTPUT FORMAT:
{
  "thought": "Reasoning about why this change is needed...",
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
      const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("LLM failed to output JSON");
      
      const parsed = AgentResponseSchema.parse(JSON.parse(jsonMatch[0]));
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

