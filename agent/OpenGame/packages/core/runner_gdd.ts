
import { Config } from './src/config/config.js';
import { GenerateGDDTool } from './src/tools/generate-gdd.js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

dotenv.config();

async function main() {
  const workspacePath = path.resolve('../../temp_workspaces/neon_survivors');
  
  const config = new Config({
    targetDir: workspacePath,
    projectRoot: path.resolve('../..'),
    cwd: workspacePath,
    env: process.env as any
  });

  await (config as any).initialize();

  const tool = new GenerateGDDTool(config);
  const invocation = (tool as any).createInvocation({
    raw_user_requirement: "Neon Survivors: A cyberpunk top-down survivor game. The player is a soldier in a neon city fighting aggressive drones. Collect scrap from fallen enemies to level up. Features: automatic firing at nearest enemy, wave-based difficulty, boss encounters (industrial robot arms).",
    archetype: "top_down"
  });
  
  console.log('Starting GDD generation...');
  const result = await invocation.execute(new AbortController().signal);
  
  if (result.llmContent) {
    const match = result.llmContent.match(/<gdd-content>([\s\S]*?)<\/gdd-content>/);
    const gddText = match ? match[1].trim() : result.llmContent;
    
    const gddPath = path.join(workspacePath, 'GAME_DESIGN.md');
    await fs.writeFile(gddPath, gddText, 'utf-8');
    console.log(`GDD saved to: ${gddPath}`);
  }
  
  console.log('GDD Generation Result:', result.returnDisplay);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
