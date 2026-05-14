/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType, createContentGenerator, createContentGeneratorConfig } from '../core/contentGenerator.js';
import { Config } from '../config/config.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env relative to this file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function checkProvider(authType: AuthType, envVar: string) {
  const providerName = authType;
  const apiKey = process.env[envVar];
  
  if (!apiKey) {
    console.log(`[ ] ${providerName}: Skipped (No ${envVar})`);
    return;
  }

  // Use the factory to create a fully populated config (with baseUrls and default models)
  const config = createContentGeneratorConfig(authType, {});
  console.log(`[*] ${providerName}: Checking with model "${config.model}"...`);
  
  try {
    // Create a minimal config
    const gcConfig = new Config({
      targetDir: process.cwd(),
    });

    const generator = await createContentGenerator(config, gcConfig);
    
    // Simple test message
    const response = await generator.generateContent(
      { 
        model: config.model,
        contents: [{ role: 'user', parts: [{ text: 'Respond with "OK" if you can read this.' }] }]
      },
      'diagnostic'
    );

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log(`[+] ${providerName}: SUCCESS! Response: ${text.substring(0, 50).replace(/\n/g, ' ').trim()}`);
  } catch (error: any) {
    console.log(`[-] ${providerName}: FAILED.`);
    console.log(`    Error: ${error.message}`);
    if (error.status) console.log(`    Status: ${error.status}`);
    if (error.stack) {
        // Only print first 3 lines of stack trace for brevity
        console.log(`    Stack: ${error.stack.split('\n').slice(0, 3).join('\n    ')}`);
    }
  }
}

async function main() {
  console.log('=== OpenGame API Diagnostic ===\n');

  const providers = [
    { type: AuthType.USE_GEMINI, env: 'GOOGLE_API_KEY' },
    { type: AuthType.USE_OPENROUTER, env: 'OPENROUTER_API_KEY' },
    { type: AuthType.USE_MISTRAL, env: 'MISTRAL_API_KEY' },
    { type: AuthType.USE_TOGETHER, env: 'TOGETHER_API_KEY' },
    { type: AuthType.USE_SAMBANOVA, env: 'SAMBANOVA_API_KEY' },
    { type: AuthType.USE_CEREBRAS, env: 'CEREBRAS_API_KEY' },
    { type: AuthType.USE_COHERE, env: 'COHERE_API_KEY' },
    { type: AuthType.USE_HUGGINGFACE, env: 'HUGGINGFACE_API_KEY' },
    { type: AuthType.USE_GROQ, env: 'GROQ_API_KEY' },
    { type: AuthType.USE_DEEPSEEK, env: 'DEEPSEEK_API_KEY' },
  ];

  for (const provider of providers) {
    await checkProvider(provider.type, provider.env);
  }

  console.log('\n=== Diagnostic Complete ===');
}

main().catch(console.error);
