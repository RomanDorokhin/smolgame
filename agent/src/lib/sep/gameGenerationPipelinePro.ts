/**
 * SmolGame Engine Pipeline (SEP) - World Class Aider Edition
 */

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  errors: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  generateFn: (messages: any[]) => Promise<string>;
  previousCode?: string;
}

const AIDER_INSTRUCTIONS = `
You are a World Class Game Developer. 
Output ONLY raw HTML/JS/CSS code. No comments, no explanations.

MODIFICATION RULES:
If you are editing existing code, use SEARCH/REPLACE blocks:
<<<<<<< SEARCH
[exact lines from current code]
=======
[replacement lines]
>>>>>>>
`;

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { generateFn, previousCode } = options;

  try {
    const messages = [
        { role: 'system', content: AIDER_INSTRUCTIONS }
    ];

    if (previousCode) {
        messages.push({ role: 'system', content: `CURRENT CODE:\n${previousCode}` });
        messages.push({ role: 'user', content: `Apply these changes: ${userRequest}` });
    } else {
        messages.push({ role: 'user', content: userRequest });
    }

    const response = await generateFn(messages);

    return {
      isSuccess: true,
      generatedCode: response,
      errors: []
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, errors: [(e as Error).message] };
  }
}
