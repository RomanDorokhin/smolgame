import express from 'express';
import cors from 'cors';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import { 
  Config, 
  GeminiClient, 
  createContentGenerator, 
  createContentGeneratorConfig,
  AuthType,
  GeminiEventType,
  type ToolCallRequestInfo,
  executeToolCall
} from '../packages/core/src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/generate', async (req, res) => {
  const { prompt, apiKey, model, provider } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  // 1. Create a temp directory for the game
  const gameId = `game_${Date.now()}`;
  const workspacePath = join(root, 'temp_workspaces', gameId);
  fs.mkdirSync(workspacePath, { recursive: true });

  console.log(`[OpenGame API] Starting generation for ${gameId} in ${workspacePath}`);

  try {
    // 2. Initialize OpenGame Config
    const config = new Config({
      targetDir: workspacePath,
      cwd: workspacePath,
      debugMode: true,
      sessionId: gameId
    });
    
    let authType = AuthType.USE_OPENAI;
    if (provider === 'gemini') authType = AuthType.USE_GEMINI;
    if (provider === 'anthropic') authType = AuthType.USE_ANTHROPIC;
    
    // 3. Set up Auth & Generator
    let baseUrl = undefined;
    if (provider === 'openrouter') baseUrl = 'https://openrouter.ai/api/v1';
    if (provider === 'mistral') baseUrl = 'https://api.mistral.ai/v1';
    if (provider === 'sambanova') baseUrl = 'https://api.sambanova.ai/v1';
    if (provider === 'together') baseUrl = 'https://api.together.xyz/v1';
    if (provider === 'cerebras') baseUrl = 'https://api.cerebras.ai/v1';
    if (provider === 'llm7') baseUrl = 'https://api.llm7.io/v1';

    config.updateCredentials({
      apiKey,
      model: model || 'mistral-large-latest',
      baseUrl,
      samplingParams: {
        max_tokens: 8192
      }
    });
    
    await config.refreshAuth(authType, true);
    await config.initialize();

    const client = new GeminiClient(config);
    await client.initialize();
    
    // For Gemini: use full agentic tool loop
    // For OpenAI-compatible: use direct text mode (no tools)
    const isGemini = provider === 'gemini';

    if (isGemini) {
      // GEMINI AGENTIC LOOP — supports tools natively
      await client.setTools();

      const fullPrompt = `TASK: Create a professional, single-file web game.
REQUIREMENTS: ${prompt}
CONSTRAINTS:
- Language: Russian for UI, English for code.
- Style: Premium, modern, animated.
- File: MUST be index.html only.
Use your write_file tool to save the game as index.html in the current directory.`;

      let currentRequest: any = [{ text: fullPrompt }];
      let iterations = 0;
      const MAX_ITERATIONS = 20;

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        console.log(`[OpenGame API] Gemini iteration ${iterations}...`);

        const stream = client.sendMessageStream(currentRequest, new AbortController().signal, gameId, {
          isContinuation: iterations > 1
        });

        const toolCalls: ToolCallRequestInfo[] = [];
        let finished = false;

        for await (const event of stream) {
          if (event.type === GeminiEventType.Error) throw new Error(JSON.stringify(event.value));
          if (event.type === GeminiEventType.ToolCallRequest) toolCalls.push(event.value);
          if (event.type === GeminiEventType.Finished) finished = true;
        }

        if (toolCalls.length > 0) {
          const results = [];
          for (const toolCall of toolCalls) {
            console.log(`[OpenGame API] Tool: ${toolCall.name}`);
            const response = await executeToolCall(config, toolCall, new AbortController().signal);
            results.push({
              functionResponse: {
                name: toolCall.name,
                response: response.responseParts[0].functionResponse?.response
              }
            });
          }
          currentRequest = results;
        } else if (finished) {
          break;
        } else {
          break;
        }
      }
    } else {
      // DIRECT TEXT MODE — for SambaNova, Mistral, Cerebras, OpenRouter, etc.
      // CRITICAL: Clear tools so non-Gemini providers don't reject the request
      (client as any).getChat().setTools([]);
      console.log(`[OpenGame API] Using direct text mode for provider: ${provider} (tools cleared)`);

      const fullPrompt = `You are an expert web game developer. Create a complete, self-contained HTML5 game.

TASK: ${prompt}

REQUIREMENTS:
- Output ONLY a single valid HTML file, nothing else
- No markdown, no explanation, no code blocks — just the raw HTML starting with <!DOCTYPE html>
- Include Phaser 3 via CDN: https://cdnjs.cloudflare.com/ajax/libs/phaser/3.60.0/phaser.min.js
- Language: Russian for any UI text
- Style: dark background, premium look with gradients and animations
- The game must be fully playable and fun

Output the complete index.html file now:`;

      const stream = client.sendMessageStream(
        [{ text: fullPrompt }],
        new AbortController().signal,
        gameId
      );

      let fullText = '';
      let eventCount = 0;
      for await (const event of stream) {
        eventCount++;
        const ev = event as any;
        // Log first 5 events to debug
        if (eventCount <= 5) {
          console.log(`[OpenGame API] Event #${eventCount}: type=${ev.type}, valueType=${typeof ev.value}, valueSample=${JSON.stringify(ev.value)?.substring(0, 100)}`);
        }
        if (ev.type === GeminiEventType.Error) throw new Error(JSON.stringify(ev.value));
        if (ev.type === GeminiEventType.Content) {
          fullText += ev.value || '';
        }
        // Also try collecting raw text from value if it's a string
        if (typeof ev.value === 'string' && ev.type !== GeminiEventType.Error) {
          if (ev.type !== GeminiEventType.Content) fullText += ev.value;
        }
      }
      console.log(`[OpenGame API] Stream done. Total events: ${eventCount}, text length: ${fullText.length}`);

      // Extract HTML from the response (model may wrap it anyway)
      let html = fullText.trim();
      const htmlMatch = html.match(/<!DOCTYPE html[\s\S]*<\/html>/i);
      if (htmlMatch) html = htmlMatch[0];

      if (!html || !html.includes('</html>')) {
        console.log('[OpenGame API] Raw output:', html.substring(0, 500));
        throw new Error('Model did not return valid HTML. Output: ' + html.substring(0, 200));
      }

      // Save directly
      const indexPath = join(workspacePath, 'index.html');
      fs.writeFileSync(indexPath, html, 'utf8');
      console.log(`[OpenGame API] Saved ${html.length} chars to ${indexPath}`);
    }

    // 4. Read the generated file
    const indexPath = join(workspacePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      const code = fs.readFileSync(indexPath, 'utf8');
      res.json({ success: true, code, gameId });
    } else {
      const files = fs.readdirSync(workspacePath);
      const htmlFile = files.find(f => f.endsWith('.html'));
      if (htmlFile) {
        const code = fs.readFileSync(join(workspacePath, htmlFile), 'utf8');
        res.json({ success: true, code, gameId });
      } else {
        throw new Error('No HTML file was generated.');
      }
    }
  } catch (error: any) {
    console.error(`[OpenGame API] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

import { chromium } from 'playwright';

app.post('/api/validate', async (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'HTML is required' });

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    const errors: string[] = [];
    const logs: string[] = [];

    page.on('pageerror', (err) => errors.push(`RUNTIME ERROR: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') logs.push(`CONSOLE ERROR: ${msg.text()}`);
    });

    await page.setContent(html, { waitUntil: 'load' });
    
    // Wait for a bit to see if any immediate errors occur
    await page.waitForTimeout(1000);

    // Test START button
    try {
      const startBtn = await page.$('button:has-text("START")');
      if (startBtn) {
        await startBtn.click();
        await page.waitForTimeout(500);
        const state = await page.evaluate(() => (window as any).smolState);
        if (state !== 'play') {
          errors.push("VALIDATION FAILED: Clicked 'START' but smolState is not 'play'.");
        }
      } else {
        errors.push("VALIDATION FAILED: 'START' button not found.");
      }
    } catch (e: any) {
      errors.push(`VALIDATION ERROR during interaction: ${e.message}`);
    }

    // Test Visual Activity (Ensure game isn't frozen)
    const getScreenshot = async () => await page.evaluate(() => {
      const canvas = document.getElementById('c') as HTMLCanvasElement;
      return canvas.toDataURL();
    });

    const screen1 = await getScreenshot();
    await page.waitForTimeout(500);
    const screen2 = await getScreenshot();

    if (screen1 === screen2) {
      errors.push("VALIDATION FAILED: Game appears to be frozen. No visual changes detected on canvas after 500ms of 'play' state.");
    }

    const finalOk = errors.length === 0;
    res.json({ ok: finalOk, errors: [...errors, ...logs] });
  } catch (error: any) {
    console.error(`[OpenGame API] Validation Error:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 OpenGame API Server running on http://localhost:${PORT}`);
});
