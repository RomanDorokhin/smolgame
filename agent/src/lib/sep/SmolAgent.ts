import { LLMConfig, generateStream } from "../llm-api";
import { analyzeGameJS, extractScripts, replaceFunctionInCode } from "./ast-analyzer";
import { getRelevantKnowledge } from "../knowledge-base";

export interface AgentStep {
  thought: string;
  action: string;
  observation: string;
  codeSnapshot?: string;
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

  /**
   * Main entry point for modifying or fixing code.
   */
  async runFixLoop(task: string, initialCode: string, runtimeError?: string): Promise<string> {
    this.currentCode = initialCode;
    const maxIterations = 5;
    
    for (let i = 0; i < maxIterations; i++) {
      this.config.onProgress(`Анализирую (итерация ${i + 1}/${maxIterations})...`);
      
      const step = await this.executeStep(task, runtimeError);
      this.history.push(step);
      
      if (step.action.includes('FINISH')) {
        this.config.onProgress(`Изменения применены успешно.`);
        break;
      }

      if (step.observation.includes('ERROR')) {
         this.config.onProgress(`⚠️ Ошибка инструмента: ${step.observation}. Пробую исправить...`);
      } else {
         this.config.onProgress(`✅ Успех: ${step.observation.slice(0, 50)}...`);
      }
    }

    return this.currentCode;
  }

  private async executeStep(task: string, runtimeError?: string): Promise<AgentStep> {
    const systemPrompt = `You are a Senior Autonomous AI Game Developer. 
Your goal is to fulfill the <task> by analyzing code and applying precise fixes.

CORE PRINCIPLES:
1. THINK before you act. Use <thought> tags. Describe WHAT is wrong and HOW you will fix it.
2. USE TOOLS. Use <action> tags with one of:
   - REPLACE_BLOCK: search_string ---REPLACE--- replacement_string
   - REWRITE_FUNCTION: Full new function code (init, update, draw, onTouch).
   - INJECT_JUICE: Add screen shake or particles to existing logic.
   - FINISH: Stop if the task is done.
3. BE PRECISE. Use exact string matching for search.
4. MOBILE FIRST. Always consider touch-action:none and 9:16 aspect ratio.

KNOWLEDGE:
${getRelevantKnowledge(['juice', 'logic', 'physics', 'mobile'])}

AVAILABLE GLOBALS: W, H, ctx, scale, score, hi, shake, cam, joy, swipe, glow, nglow, sfx, Part.

CURRENT CODE:
${this.currentCode}

${runtimeError ? `RUNTIME ERROR DETECTED IN IFRAME:\n${runtimeError}` : ''}

HISTORY OF ACTIONS:
${this.history.map((s, i) => `Step ${i+1}: Action=${s.action}, Observation=${s.observation}`).join('\n')}

Format your output exactly as:
<thought> your reasoning </thought>
<action> TOOL_NAME: payload </action>`;

    let fullResponse = "";
    const msgs = [{ role: "system" as const, content: systemPrompt }, { role: "user" as const, content: task }];
    
    const stream = generateStream(msgs, this.config.llm, this.config.signal);
    for await (const chunk of stream) {
      fullResponse += chunk;
    }

    const thought = fullResponse.match(/<thought>([\s\S]*?)<\/thought>/i)?.[1].trim() || "";
    const actionMatch = fullResponse.match(/<action>([\s\S]*?)<\/action>/i);
    const actionRaw = actionMatch ? actionMatch[1].trim() : "FINISH";

    const observation = await this.performAction(actionRaw);

    return {
      thought,
      action: actionRaw,
      observation,
      codeSnapshot: this.currentCode
    };
  }

  private async performAction(actionRaw: string): Promise<string> {
    const [tool, ...payloadArr] = actionRaw.split(':');
    const toolName = tool.trim();
    const payload = payloadArr.join(':').trim();

    try {
      switch (toolName) {
        case 'REPLACE_BLOCK': {
           const parts = payload.split('---REPLACE---');
           if (parts.length !== 2) return "ERROR: REPLACE_BLOCK requires 'search ---REPLACE--- replacement'";
           const search = parts[0].trim();
           const replace = parts[1].trim();
           if (!this.currentCode.includes(search)) return "ERROR: Search text not found in code.";
           this.currentCode = this.currentCode.replace(search, replace);
           return "SUCCESS: Block replaced.";
        }
        case 'REWRITE_FUNCTION': {
           const funcMatch = payload.match(/function\s+(\w+)\s*\(/);
           if (!funcMatch) return "ERROR: Could not find function name in payload. Use 'function name() { ... }'";
           const funcName = funcMatch[1];
           
           // Use AST replacement for accuracy
           const newCode = replaceFunctionInCode(this.currentCode, funcName, payload);
           if (newCode === this.currentCode) {
              return `ERROR: Function ${funcName} not found in code or AST parse failed.`;
           }
           this.currentCode = newCode;
           return `SUCCESS: Function ${funcName} rewritten via AST.`;
        }
        case 'INJECT_JUICE': {
           this.currentCode = this.currentCode.replace(/update\(\)\s*{/i, `update() {\n  if(Math.random()<0.05) shake=5; // Injected Juice\n`);
           return "SUCCESS: Juice injected into update().";
        }
        case 'FINISH':
           return "DONE";
        default:
           return `ERROR: Unknown tool ${toolName}`;
      }
    } catch (e) {
      return `ERROR: Tool execution failed: ${(e as Error).message}`;
    }
  }
}
