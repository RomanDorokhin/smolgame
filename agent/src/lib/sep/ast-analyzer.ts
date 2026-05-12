import * as acorn from 'acorn';
import { simple as walk } from 'acorn-walk';
import * as escodegen from 'escodegen';

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
    const coreGlobals = new Set(['smolState', 'score', 'hi', 'W', 'H', 'ctx', 'scale', 'cam', 'joy', 'swipe', 'entities', 'particles', 'CONFIG']);
    const coreFunctions = new Set(['checkAABB', 'checkCircle', 'applyShake', 'burst', 'smolTriggerGameOver', 'sfx']);

    walk(ast, {
      VariableDeclaration(node: any) {
        node.declarations.forEach((d: any) => {
          if (d.id.type === 'Identifier') {
            const name = d.id.name;
            if (coreGlobals.has(name)) {
              result.warnings.push(`Pollution: Re-declaring core global "${name}". Use the provided variable instead.`);
            }
            declaredVariables.add(name);
          }
        });
      },
      FunctionDeclaration(node: any) {
        if (node.id && node.id.type === 'Identifier') {
          const name = node.id.name;
          if (coreFunctions.has(name)) {
             result.errors.push(`Redundancy: Re-defining core function "${name}". This function is already in the ENGINE CORE.`);
          }
          declaredFunctions.add(name);
        }
      },
      NewExpression(node: any) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Proxy') {
          result.warnings.push('Architectural Slop: Using Proxy (Compatibility Layer) detected. Write direct, clean code instead.');
        }
      },
      CallExpression(node: any) {
        if (node.callee.type === 'Identifier') {
          const name = node.callee.name;
          if (['init', 'update', 'draw'].includes(name)) {
             // Basic structure check
          }
        }
      }
    });

    // Feature Detection
    const featuresFound = new Set<string>();
    walk(ast, {
      CallExpression(node: any) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'burst') featuresFound.add('Particle System');
        if (node.callee.type === 'Identifier' && node.callee.name === 'sfx') featuresFound.add('Audio System');
        if (node.callee.type === 'Identifier' && node.callee.name === 'applyShake') featuresFound.add('Screen Shake');
      },
      MemberExpression(node: any) {
        if (node.object.type === 'Identifier' && node.object.name === 'storage') featuresFound.add('Persistence');
      }
    });
    result.features = Array.from(featuresFound);

    // Scoring
    let score = 70;
    score += result.features.length * 10;
    if (result.errors.length > 0) score -= 50;
    if (result.warnings.length > 0) score -= 10 * result.warnings.length;
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
    const newNodeAst = acorn.parse(newNodeCode, { ecmaVersion: 2020, sourceType: 'script' }) as any;
    
    // We expect the newNodeCode to be a single declaration/expression
    const replacementNode = newNodeAst.body[0];

    let replaced = false;
    walk(ast, {
      [nodeType]: (node: any, state: any) => {
        let match = false;
        if (nodeType === 'FunctionDeclaration' && node.id && node.id.name === searchValue) match = true;
        if (nodeType === 'ObjectProperty' && node.key && node.key.name === searchValue) match = true;

        if (match) {
          Object.assign(node, replacementNode);
          replaced = true;
        }
      }
    });
    if (!replaced) return code; // If no node was replaced, return original code

    return escodegen.generate(ast, {
      format: { indent: { style: '  ' }, quotes: 'single' },
      comment: true
    });
  } catch (e) {
    console.error("Semantic AST Replace failed", e);
    return code;
  }
}

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
