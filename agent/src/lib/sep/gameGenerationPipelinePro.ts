/**
 * SmolGame Engine Pipeline (SEP) - Pure Passthrough Version
 */

export interface PipelineResult {
  isSuccess: boolean;
  generatedCode: string | null;
  errors: string[];
}

export interface PipelineOptions {
  onProgress?: (message: string) => void;
  generateFn: (messages: any[]) => Promise<string>;
}

export async function generateGame(userRequest: string, options: PipelineOptions): Promise<PipelineResult> {
  const { generateFn } = options;

  try {
    // Чистый запрос - чистый ответ. Никаких системных инструкций.
    const response = await generateFn([
        { role: 'user', content: userRequest }
    ]);

    // Просто отдаем то, что пришло.
    return {
      isSuccess: true,
      generatedCode: response,
      errors: []
    };

  } catch (e) {
    return { isSuccess: false, generatedCode: null, errors: [(e as Error).message] };
  }
}
