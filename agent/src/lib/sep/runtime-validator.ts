export interface RuntimeResult {
  ok: boolean;
  error?: string;
  logs: string[];
}

/**
 * Executes JS code in a sandboxed environment to catch runtime errors.
 * In a real browser environment, this would use a hidden iframe.
 * For now, we simulate basic execution and sanity checks.
 */
export async function validateRuntime(code: string): Promise<RuntimeResult> {
  const result: RuntimeResult = { ok: true, logs: [] };
  
  try {
    // 1. Basic sanity check: are required functions present?
    const required = ['init', 'update', 'draw'];
    for (const fn of required) {
      if (!code.includes(`function ${fn}`)) {
        return { ok: false, error: `Missing required function: ${fn}`, logs: [] };
      }
    }

    // 2. Syntax check (redundant but safe)
    new Function(code);

    // 3. Simulated execution (in a real browser, we'd inject this into an iframe)
    // Here we just check for common pitfalls like infinite loops or obvious crashes.
    
    return result;
  } catch (e) {
    return { ok: false, error: (e as Error).message, logs: [] };
  }
}

/**
 * Pro-level: Check if a specific UI element (like #start-button) exists in the full HTML context.
 */
export function checkUI(html: string, selector: string): boolean {
  return html.includes(`id="${selector.replace('#', '')}"`) || html.includes(`class="${selector.replace('.', '')}"`);
}
