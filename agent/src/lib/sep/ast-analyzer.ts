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

    // Robust Feature Detection via AST
    const featuresFound = new Set<string>();
    
    function findFeatures(node: any) {
      if (!node) return;
      
      // Detection for Screen Shake (Math.random in update/shake)
      if (node.type === 'CallExpression' && 
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'Math' &&
          node.callee.property.name === 'random') {
        featuresFound.add('Screen Shake');
      }

      // Detection for Particle System (new Part or particles array)
      if (node.type === 'NewExpression' && node.callee.name === 'Part') {
        featuresFound.add('Particle System');
      }

      // Detection for Audio System
      if (node.type === 'CallExpression' && node.callee.name === 'playSound') {
        featuresFound.add('Audio System');
      }

      // Detection for Persistence
      if (node.type === 'MemberExpression' && node.object.name === 'localStorage') {
        featuresFound.add('Persistence');
      }

      // Recursive walk
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) node[key].forEach(findFeatures);
          else findFeatures(node[key]);
        }
      }
    }

    findFeatures(ast);
    result.features = Array.from(featuresFound);

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
export function replaceNodeInCode(code: string, nodeType: string, searchKey: string, searchValue: string, newNodeCode: string): string {
  try {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' }) as any;
    let start = -1;
    let end = -1;

    function findNode(node: any) {
      if (node.type === nodeType) {
        if (nodeType === 'FunctionDeclaration' && node.id && node.id.name === searchValue) {
           start = node.start; end = node.end; return;
        }
        if (nodeType === 'ObjectProperty' && node.key && node.key.name === searchValue) {
           start = node.start; end = node.end; return;
        }
      }
      for (const key in node) {
        if (node[key] && typeof node[key] === 'object') {
          if (Array.isArray(node[key])) node[key].forEach(findNode);
          else findNode(node[key]);
        }
      }
    }

    findNode(ast);

    if (start !== -1 && end !== -1) {
      return code.slice(0, start) + newNodeCode + code.slice(end);
    }
    return code;
  } catch (e) {
    console.error("AST Replace failed", e);
    return code;
  }
}

/**
 * Validates code for syntax errors and common issues.
 */
export function validateCode(code: string): { ok: boolean; error?: string } {
  try {
    acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function replaceFunctionInCode(code: string, funcName: string, newFunctionCode: string): string {
  return replaceNodeInCode(code, 'FunctionDeclaration', 'name', funcName, newFunctionCode);
}

