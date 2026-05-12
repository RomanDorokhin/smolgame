import * as acorn from 'acorn';

export interface AnalysisResult {
  errors: string[];
  warnings: string[];
  features: string[];
  score: number; // 0-100
}

export function analyzeGameJS(code: string): AnalysisResult {
  const result: AnalysisResult = {
    errors: [],
    warnings: [],
    features: [],
    score: 0
  };

  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'script'
    }) as any;

    const declaredVariables = new Set<string>();
    const declaredFunctions = new Set<string>();
    const usedBeforeDeclaration: string[] = [];

    // Simple one-pass walker
    function walk(node: any) {
      if (!node) return;

      switch (node.type) {
        case 'VariableDeclaration':
          node.declarations.forEach((d: any) => {
            if (d.id.type === 'Identifier') declaredVariables.add(d.id.name);
          });
          break;
        case 'FunctionDeclaration':
          if (node.id && node.id.type === 'Identifier') declaredFunctions.add(node.id.name);
          break;
        case 'CallExpression':
          if (node.callee.type === 'Identifier') {
            const name = node.callee.name;
            // Common initialization functions
            if (['init', 'start', 'setup', 'resizeCanvas'].includes(name)) {
              if (!declaredFunctions.has(name) && !declaredVariables.has(name)) {
                // If it's a call at the top level (Program), it might be TDZ
                usedBeforeDeclaration.push(name);
              }
            }
          }
          break;
      }

      // Recursive walk
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) {
            node[key].forEach(walk);
          } else {
            walk(node[key]);
          }
        }
      }
    }

    walk(ast);

    if (usedBeforeDeclaration.length > 0) {
      result.errors.push(`Temporal Dead Zone Detected: Calling ${usedBeforeDeclaration.join(', ')} before declaration.`);
    }

    // Feature detection (Juice)
    if (code.includes('Math.random() * 2 - 1') && code.includes('shake')) {
      result.features.push('Screen Shake');
    }
    if (code.includes('particles') || code.includes('Particle')) {
      result.features.push('Particle System');
    }
    if (code.includes('AudioContext') || code.includes('new Audio') || code.includes('playSound')) {
      result.features.push('Audio System');
    }
    if (code.includes('localStorage') || code.includes('safeStorage')) {
      result.features.push('Persistence');
    }

    // Scoring
    let score = 50;
    score += result.features.length * 10;
    if (result.errors.length > 0) score -= 40;
    result.score = Math.min(100, Math.max(0, score));

  } catch (e) {
    result.errors.push(`JS Syntax Error: ${(e as Error).message}`);
    result.score = 0;
  }

  return result;
}

export function extractScripts(html: string): string[] {
  const scripts: string[] = [];
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gim;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1].trim()) {
      scripts.push(match[1]);
    }
  }
  return scripts;
}
export function replaceFunctionInCode(code: string, funcName: string, newFunctionCode: string): string {
  try {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' }) as any;
    let start = -1;
    let end = -1;

    function findFunc(node: any) {
      if (node.type === 'FunctionDeclaration' && node.id && node.id.name === funcName) {
        start = node.start;
        end = node.end;
        return;
      }
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) node[key].forEach(findFunc);
          else findFunc(node[key]);
        }
      }
    }

    findFunc(ast);

    if (start !== -1 && end !== -1) {
      return code.slice(0, start) + newFunctionCode + code.slice(end);
    }
    return code; // Fallback
  } catch (e) {
    console.error("AST Replace failed", e);
    return code;
  }
}
