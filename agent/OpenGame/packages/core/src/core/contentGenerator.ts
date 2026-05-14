/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  GenerateContentResponse,
  type CountTokensParameters,
  type CountTokensResponse,
  type EmbedContentParameters,
  type EmbedContentResponse,
  type GenerateContentParameters,
} from '@google/genai';
import type { Config } from '../config/config.js';
import { LoggingContentGenerator } from './loggingContentGenerator/index.js';

/**
 * Authentication types for different AI providers.
 */
export enum AuthType {
  USE_GEMINI = 'USE_GEMINI',
  USE_VERTEX_AI = 'USE_VERTEX_AI',
  USE_ANTHROPIC = 'USE_ANTHROPIC',
  USE_OPENAI = 'USE_OPENAI',
  USE_OPENROUTER = 'USE_OPENROUTER',
  USE_TOGETHER = 'USE_TOGETHER',
  USE_MISTRAL = 'USE_MISTRAL',
  USE_SAMBANOVA = 'USE_SAMBANOVA',
  USE_CEREBRAS = 'USE_CEREBRAS',
  USE_COHERE = 'USE_COHERE',
  USE_GROQ = 'USE_GROQ',
  USE_DEEPSEEK = 'USE_DEEPSEEK',
  USE_HUGGINGFACE = 'USE_HUGGINGFACE',
  QWEN_OAUTH = 'QWEN_OAUTH',
}

/**
 * Configuration for a content generator.
 */
export interface ContentGeneratorConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  authType?: AuthType;
  vertexai?: {
    location?: string;
    project?: string;
  };
  userAgent?: string;
  enableOpenAILogging?: boolean;
  openAILoggingDir?: string;
  schemaCompliance?: 'auto' | 'openapi_30';
}

/**
 * Interface for generating content from an AI model.
 */
export interface ContentGenerator {
  generateContent(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<GenerateContentResponse>;

  generateContentStream(
    request: GenerateContentParameters,
    userPromptId: string,
  ): Promise<AsyncGenerator<GenerateContentResponse>>;

  countTokens(req: CountTokensParameters): Promise<CountTokensResponse>;

  embedContent(req: EmbedContentParameters): Promise<EmbedContentResponse>;

  useSummarizedThinking(): boolean;
}

export function createContentGeneratorConfig(
  authType: AuthType,
  config: ContentGeneratorConfig,
): ContentGeneratorConfig {
  let newContentGeneratorConfig = { ...config, authType };

  if (authType === AuthType.USE_OPENAI) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['OPENAI_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl || process.env['OPENAI_BASE_URL'],
      model: newContentGeneratorConfig.model || process.env['OPENAI_MODEL'],
    };
  }

  if (authType === AuthType.USE_OPENROUTER) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['OPENROUTER_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['OPENROUTER_BASE_URL'] ||
        'https://openrouter.ai/api/v1',
      model:
        newContentGeneratorConfig.model || process.env['OPENROUTER_MODEL'],
    };
  }

  if (authType === AuthType.USE_TOGETHER) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['TOGETHER_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['TOGETHER_BASE_URL'] ||
        'https://api.together.xyz/v1',
      model: newContentGeneratorConfig.model || process.env['TOGETHER_MODEL'],
    };
  }

  if (authType === AuthType.USE_MISTRAL) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['MISTRAL_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['MISTRAL_BASE_URL'] ||
        'https://api.mistral.ai/v1',
      model: newContentGeneratorConfig.model || process.env['MISTRAL_MODEL'],
    };
  }

  if (authType === AuthType.USE_SAMBANOVA) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['SAMBANOVA_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['SAMBANOVA_BASE_URL'] ||
        'https://api.sambanova.ai/v1',
      model: newContentGeneratorConfig.model || process.env['SAMBANOVA_MODEL'] || 'Meta-Llama-3.1-70B-Instruct',
    };
  }

  if (authType === AuthType.USE_CEREBRAS) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['CEREBRAS_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['CEREBRAS_BASE_URL'] ||
        'https://api.cerebras.ai/v1',
      model: newContentGeneratorConfig.model || process.env['CEREBRAS_MODEL'] || 'llama3.1-8b',
    };
  }

  if (authType === AuthType.USE_COHERE) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['COHERE_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['COHERE_BASE_URL'] ||
        'https://api.cohere.ai/v1',
      model: newContentGeneratorConfig.model || process.env['COHERE_MODEL'] || 'command-r-plus',
    };
  }

  if (authType === AuthType.USE_GROQ) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['GROQ_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['GROQ_BASE_URL'] ||
        'https://api.groq.com/openai/v1',
      model: newContentGeneratorConfig.model || process.env['GROQ_MODEL'] || 'llama-3.3-70b-versatile',
    };
  }

  if (authType === AuthType.USE_DEEPSEEK) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['DEEPSEEK_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['DEEPSEEK_BASE_URL'] ||
        'https://api.deepseek.com/v1',
      model: newContentGeneratorConfig.model || process.env['DEEPSEEK_MODEL'] || 'deepseek-chat',
    };
  }

  if (authType === AuthType.USE_HUGGINGFACE) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey:
        newContentGeneratorConfig.apiKey || process.env['HUGGINGFACE_API_KEY'],
      baseUrl:
        newContentGeneratorConfig.baseUrl ||
        process.env['HUGGINGFACE_BASE_URL'] ||
        'https://api-inference.huggingface.co/v1',
      model:
        newContentGeneratorConfig.model || process.env['HUGGINGFACE_MODEL'] || 'meta-llama/Llama-3.2-3B-Instruct',
    };
  }

  if (authType === AuthType.USE_OPENROUTER) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['OPENROUTER_API_KEY'],
      baseUrl: newContentGeneratorConfig.baseUrl || 'https://openrouter.ai/api/v1',
      model: newContentGeneratorConfig.model || process.env['OPENROUTER_MODEL'] || 'google/gemini-2.0-flash-001',
    };
  }

  if (authType === AuthType.USE_MISTRAL) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['MISTRAL_API_KEY'],
      baseUrl: newContentGeneratorConfig.baseUrl || 'https://api.mistral.ai/v1',
      model: newContentGeneratorConfig.model || process.env['MISTRAL_MODEL'] || 'mistral-small-latest',
    };
  }

  if (authType === AuthType.USE_TOGETHER) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['TOGETHER_API_KEY'],
      baseUrl: newContentGeneratorConfig.baseUrl || 'https://api.together.xyz/v1',
      model: newContentGeneratorConfig.model || process.env['TOGETHER_MODEL'] || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
    };
  }

  if (authType === AuthType.USE_GEMINI) {
    newContentGeneratorConfig = {
      ...newContentGeneratorConfig,
      apiKey: newContentGeneratorConfig.apiKey || process.env['GOOGLE_API_KEY'],
      model: newContentGeneratorConfig.model || process.env['GOOGLE_MODEL'] || 'gemini-2.0-flash-001',
    };
  }

  return newContentGeneratorConfig as ContentGeneratorConfig;
}

export async function createContentGenerator(
  config: ContentGeneratorConfig,
  gcConfig: Config,
  isInitialAuth?: boolean,
): Promise<ContentGenerator> {
  // Sync the config back to gcConfig so decorators can access it
  if (gcConfig && typeof gcConfig.setContentGeneratorConfig === 'function') {
    gcConfig.setContentGeneratorConfig(config);
  }

  if (
    config.authType === AuthType.USE_OPENAI ||
    config.authType === AuthType.USE_OPENROUTER ||
    config.authType === AuthType.USE_TOGETHER ||
    config.authType === AuthType.USE_MISTRAL ||
    config.authType === AuthType.USE_SAMBANOVA ||
    config.authType === AuthType.USE_CEREBRAS ||
    config.authType === AuthType.USE_COHERE ||
    config.authType === AuthType.USE_GROQ ||
    config.authType === AuthType.USE_DEEPSEEK ||
    config.authType === AuthType.USE_HUGGINGFACE
  ) {
    const { createOpenAIContentGenerator } = await import(
      './openaiContentGenerator/index.js'
    );
    const generator = createOpenAIContentGenerator(config, gcConfig);
    return new LoggingContentGenerator(generator, gcConfig);
  }

  if (config.authType === AuthType.QWEN_OAUTH) {
    const { getQwenOAuthClient } = await import('../qwen/qwenOAuth2.js');
    const { QwenContentGenerator } = await import(
      '../qwen/qwenContentGenerator.js'
    );

    try {
      const qwenClient = await getQwenOAuthClient(
        gcConfig,
        isInitialAuth ? { requireCachedCredentials: true } : undefined,
      );
      const generator = new QwenContentGenerator(qwenClient, config, gcConfig);
      return new LoggingContentGenerator(generator, gcConfig);
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  if (config.authType === AuthType.USE_ANTHROPIC) {
    const { createAnthropicContentGenerator } = await import(
      './anthropicContentGenerator/index.js'
    );
    const generator = createAnthropicContentGenerator(config, gcConfig);
    return new LoggingContentGenerator(generator, gcConfig);
  }

  if (
    config.authType === AuthType.USE_GEMINI ||
    config.authType === AuthType.USE_VERTEX_AI
  ) {
    const { createGeminiContentGenerator } = await import(
      './geminiContentGenerator/index.js'
    );
    const generator = createGeminiContentGenerator(config, gcConfig);
    return new LoggingContentGenerator(generator, gcConfig);
  }

  throw new Error(
    `Error creating contentGenerator: Unsupported authType: ${config.authType}`,
  );
}
