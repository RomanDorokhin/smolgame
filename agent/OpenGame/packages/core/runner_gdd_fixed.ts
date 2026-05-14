import { GenerateGDDTool } from './src/tools/generate-gdd';
import { Config } from './src/config/config';
import * as path from 'path';
import fetch from 'node-fetch';
import * as fs from 'fs';

async function main() {
  console.log("--- OpenGame ULTIMATE ROTATION Runner ---");
  
  const projectRoot = path.resolve(process.cwd(), '../..');
  const workspacePath = path.join(projectRoot, 'temp_workspaces/neon_survivors');

  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  const config = new Config({
    targetDir: workspacePath,
    cwd: workspacePath,
    debugMode: false,
    projectRoot: projectRoot,
    env: process.env as any
  } as any);

  await (config as any).initialize();

  const providers = [
    // Gemini Direct (Native v1)
    { 
      name: "Gemini-Native", 
      key: process.env.GEMINI_API_KEY || "YOUR_GEMINI_KEY", 
      url: "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent", 
      model: "gemini-1.5-flash", 
      type: "gemini" 
    },

    // Cohere (Native)
    { 
      name: "Cohere", 
      key: process.env.COHERE_API_KEY || "YOUR_COHERE_KEY", 
      url: "https://api.cohere.ai/v1/chat", 
      model: "command-r", 
      type: "cohere" 
    },

    // Mistral 7B (OpenAI Style)
    { 
      name: "Mistral", 
      key: process.env.MISTRAL_API_KEY || "YOUR_MISTRAL_KEY", 
      url: "https://api.mistral.ai/v1", 
      model: "open-mistral-7b", 
      type: "openai" 
    },
    
    // OpenRouter (Llama 3.1 8B Free)
    { 
      name: "OR-1", 
      key: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_KEY", 
      url: "https://openrouter.ai/api/v1", 
      model: "meta-llama/llama-3.1-8b-instruct:free", 
      type: "openai" 
    }
  ];

  const params = {
    gameName: "Neon Survivors",
    gamePitch: "A cyberpunk survivor-like top-down shooter. High speed, neon visuals, synthwave pulse. The player fights waves of robotic drones in a neon city. Collect scrap to upgrade weapons.",
    archetype: "top_down" as const
  };

  for (const p of providers) {
    console.log(`\n[AGENT] Trying Provider: ${p.name} | Model: ${p.model}`);
    
    try {
      const tool = new GenerateGDDTool(config);
      const invocation = (tool as any).createInvocation(params);
      
      const systemPrompt = (invocation as any).buildSystemPrompt();
      const userPrompt = (invocation as any).buildUserPrompt();

      let content = "";

      if (p.type === "gemini") {
        console.log(`[DEBUG] Sending native request to Gemini...`);
        const response = await fetch(`${p.url}?key=${p.key}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}` }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 8000 }
          })
        });
        
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        
        const data = await response.json() as any;
        content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
      } else if (p.type === "cohere") {
        console.log(`[DEBUG] Sending native request to Cohere...`);
        const response = await fetch(p.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${p.key}`
          },
          body: JSON.stringify({
            message: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}`,
            model: p.model
          })
        });
        
        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        
        const data = await response.json() as any;
        content = data.text || "";
        
      } else {
        console.log(`[DEBUG] Sending OpenAI-style request to ${p.name}...`);
        const response = await fetch(`${p.url}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${p.key}`,
            'HTTP-Referer': 'https://github.com/OpenGame',
            'X-Title': 'OpenGame Autonomous Runner'
          },
          body: JSON.stringify({
            model: p.model,
            messages: [
              { role: 'user', content: `SYSTEM INSTRUCTIONS:\n${systemPrompt}\n\nUSER REQUEST:\n${userPrompt}` }
            ],
            temperature: 0.7
          })
        });

        if (response.status === 429) {
          console.warn(`[WARNING] 429 Rate Limit for ${p.name}. Waiting 30s...`);
          await new Promise(r => setTimeout(r, 30000));
          throw new Error("429");
        }

        if (!response.ok) {
          const body = await response.text();
          throw new Error(`HTTP ${response.status}: ${body}`);
        }
        
        const data = await response.json() as any;
        content = data.choices?.[0]?.message?.content || "";
      }

      if (content) {
        const finalPath = path.join(workspacePath, 'GAME_DESIGN.md');
        fs.writeFileSync(finalPath, content);
        console.log(`\n[SUCCESS] GDD generated and SAVED to ${finalPath}`);
        return; // EXIT SUCCESS
      }
    } catch (err: any) {
      console.error(`[ERROR] Provider ${p.name} failed: ${err.message.substring(0, 300)}`);
    }
  }

  console.error("\n[CRITICAL] ALL PROVIDERS FAILED.");
}

main().catch(console.error);
