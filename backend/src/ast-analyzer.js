import * as acorn from 'acorn';
import { simple as walk } from 'acorn-walk';
import * as escodegen from 'escodegen';

export function analyzeGameJS(code) {
  const result = {
    errors: [],
    warnings: [],
    features: [],
    score: 0
  };

  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 2020,
      sourceType: 'script'
    });

    const declaredVariables = new Set();
    const declaredFunctions = new Set();
    const usedBeforeDeclaration = [];

    walk(ast, {
      VariableDeclaration(node) {
        node.declarations.forEach((d) => {
          if (d.id.type === 'Identifier') declaredVariables.add(d.id.name);
        });
      },
      FunctionDeclaration(node) {
        if (node.id && node.id.type === 'Identifier') declaredFunctions.add(node.id.name);
      },
      CallExpression(node) {
        if (node.callee.type === 'Identifier') {
          const name = node.callee.name;
          if (['init', 'start', 'setup', 'resizeCanvas'].includes(name)) {
            if (!declaredFunctions.has(name) && !declaredVariables.has(name)) {
              usedBeforeDeclaration.push(name);
            }
          }
        }
      }
    });

    if (usedBeforeDeclaration.length > 0) {
      result.errors.push(`Temporal Dead Zone Detected: Calling ${usedBeforeDeclaration.join(', ')} before declaration.`);
    }

    const featuresFound = new Set();
    
    walk(ast, {
      CallExpression(node) {
        if (node.callee.type === 'MemberExpression' &&
            node.callee.object.type === 'Identifier' && node.callee.object.name === 'Math' &&
            node.callee.property.type === 'Identifier' && node.callee.property.name === 'random') {
          featuresFound.add('Screen Shake');
        }
        if (node.callee.type === 'Identifier' && node.callee.name === 'playSound') {
          featuresFound.add('Audio System');
        }
      },
      NewExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'Part') {
          featuresFound.add('Particle System');
        }
      },
      MemberExpression(node) {
        if (node.object.type === 'Identifier' && node.object.name === 'localStorage') {
          featuresFound.add('Persistence');
        }
      }
    });
    result.features = Array.from(featuresFound);

    let score = 50;
    score += result.features.length * 10;
    if (result.errors.length > 0) score -= 40;
    result.score = Math.min(100, Math.max(0, score));

  } catch (e) {
    result.errors.push(`JS Syntax Error: ${e.message}`);
    result.score = 0;
  }

  return result;
}

export function extractScripts(html) {
  const scripts = [];
  const regex = /<script\b[^>]*>([\s\S]*?)<\/script>/gim;
  let match;
  while ((match = regex.exec(html)) !== null) {
    if (match[1].trim()) {
      scripts.push(match[1]);
    }
  }
  return scripts;
}

export function replaceNodeInCode(code, nodeType, searchKey, searchValue, newNodeCode) {
  try {
    const ast = acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });
    const newNodeAst = acorn.parse(newNodeCode, { ecmaVersion: 2020, sourceType: 'script' });
    
    const replacementNode = newNodeAst.body[0];

    let replaced = false;
    walk(ast, {
      [nodeType]: (node) => {
        let match = false;
        if (nodeType === 'FunctionDeclaration' && node.id && node.id.name === searchValue) match = true;
        if (nodeType === 'ObjectProperty' && node.key && node.key.name === searchValue) match = true;

        if (match) {
          Object.assign(node, replacementNode);
          replaced = true;
        }
      }
    });
    if (!replaced) return code;

    return escodegen.generate(ast, {
      format: { indent: { style: '  ' }, quotes: 'single' },
      comment: true
    });
  } catch (e) {
    console.error("Semantic AST Replace failed", e);
    return code;
  }
}

export function validateCode(code) {
  try {
    acorn.parse(code, { ecmaVersion: 2020, sourceType: 'script' });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function replaceFunctionInCode(code, funcName, newFunctionCode) {
  return replaceNodeInCode(code, 'FunctionDeclaration', 'name', funcName, newFunctionCode);
}
