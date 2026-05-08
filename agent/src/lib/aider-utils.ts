
/**
 * Aider-style diff application logic for SmolGame Agent.
 * Handles Search & Replace blocks to modify code efficiently.
 */

export interface EditBlock {
  search: string;
  replace: string;
}

/**
 * Parses the LLM response to extract Search/Replace blocks.
 * Format:
 * <<<<<<< SEARCH
 * old code
 * =======
 * new code
 * >>>>>>> REPLACE
 */
export function parseAiderBlocks(text: string): EditBlock[] {
  const blocks: EditBlock[] = [];
  const regex = /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g;
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push({
      search: match[1],
      replace: match[2]
    });
  }
  
  return blocks;
}

/**
 * Applies a list of edit blocks to the source code.
 */
export function applyAiderBlocks(source: string, blocks: EditBlock[]): { 
  success: boolean; 
  code: string; 
  appliedCount: number; 
  failedBlocks: EditBlock[] 
} {
  let result = source;
  let appliedCount = 0;
  const failedBlocks: EditBlock[] = [];

  for (const block of blocks) {
    // We try to find the exact match first
    if (result.includes(block.search)) {
      result = result.replace(block.search, block.replace);
      appliedCount++;
    } else {
      // Try with trimmed search if exact match fails
      const trimmedSearch = block.search.trim();
      if (trimmedSearch && result.includes(trimmedSearch)) {
        // Find the original block in result to preserve surrounding whitespace if possible
        // But for simplicity in a "lite" agent, we just replace the first occurrence
        result = result.replace(trimmedSearch, block.replace);
        appliedCount++;
      } else {
        failedBlocks.push(block);
      }
    }
  }

  return {
    success: failedBlocks.length === 0,
    code: result,
    appliedCount,
    failedBlocks
  };
}

/**
 * System prompt for the Aider-style Editor Agent.
 */
export const AIDER_EDITOR_PROMPT = `
You are the OpenGame Editor Agent. Your task is to modify the existing game code to fix bugs or add features as requested by the user.

RULES:
1. You MUST use the SEARCH/REPLACE block format for all changes.
2. Every block MUST be formatted exactly like this:
<<<<<<< SEARCH
[exact code chunk from the file]
=======
[modified code chunk]
>>>>>>> REPLACE
3. Keep the SEARCH chunks long enough to be unique but as short as possible.
4. Only include the code that needs to change.
5. If you are adding a new function, find an existing one and add it after it.
6. Use the OpenGame protocol (static HTML/JS/CSS, touch controls, no external assets).

Do not explain much, just provide the necessary blocks to satisfy the user request.
`;
