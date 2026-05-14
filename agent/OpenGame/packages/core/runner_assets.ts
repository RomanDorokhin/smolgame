
import { Config } from './src/config/config.js';
import { GenerateAssetsTool } from './src/tools/generate-assets.ts';
import { GenerateTilemapTool } from './src/tools/generate-tilemap.ts';
import * as path from 'path';
import * as fs from 'fs/promises';

async function run() {
    console.log("--- OpenGame ASSET GENERATION Runner (FREE MODE) ---");

    const projectRoot = path.resolve(process.cwd(), '../..');
    const workspacePath = path.join(projectRoot, 'temp_workspaces/neon_survivors');
    
    // Ensure workspace exists
    await fs.mkdir(workspacePath, { recursive: true });

    const config = new Config({
        targetDir: workspacePath,
        cwd: process.cwd(),
        debugMode: true,
        projectRoot: projectRoot
    });

    await config.initialize();

    const assetTool = new GenerateAssetsTool(config);
    const tilemapTool = new GenerateTilemapTool(config);

    // API Keys provided by user
    const keys = {
        openrouter: process.env.OPENROUTER_API_KEY || "YOUR_OPENROUTER_KEY",
        mistral: process.env.MISTRAL_API_KEY || "YOUR_MISTRAL_KEY"
    };

    // FORCE FREE PROVIDERS
    // Pollinations for images (No API key needed, unlimited free)
    process.env.OPENGAME_IMAGE_PROVIDER = "pollinations";
    process.env.OPENGAME_IMAGE_API_KEY = "none";

    // OpenRouter Free for reasoning
    process.env.OPENGAME_REASONING_PROVIDER = "openrouter";
    process.env.OPENGAME_REASONING_API_KEY = keys.openrouter;
    process.env.OPENGAME_REASONING_MODEL = "google/gemini-2.0-flash-exp:free";

    const assetsParams = {
        assets: [
            {
                type: "background",
                key: "arena_corridor",
                description: "Cyberpunk neon-lit industrial corridor, futuristic textures, dark atmosphere with glowing cyan and magenta lights",
                resolution: "1024*1024"
            },
            {
                type: "image",
                key: "player_idle_front",
                description: "Cyberpunk soldier, neon armor, visor, pixel art style, front view, standing still",
                size: "512*512"
            },
            {
                type: "image",
                key: "enemy_zombie_idle",
                description: "Cyborg zombie, decaying flesh and mechanical parts, glowing red eyes, pixel art style, front view",
                size: "512*512"
            },
            {
                type: "image",
                key: "boss_drone_idle",
                description: "Large futuristic combat drone, multiple eye sensors, heavy plating, neon highlights, boss character",
                size: "1024*1024"
            },
            {
                type: "image",
                key: "obstacle_crate",
                description: "Sci-fi cargo crate, metal with hazard stripes, futuristic design",
                size: "256*256"
            },
            {
                type: "tileset",
                key: "ruins_floor",
                description: "Cyberpunk metallic floor tiles, worn and scratched, neon circuit patterns",
                grid_size: 3
            },
            {
                type: "tileset",
                key: "ruins_walls",
                description: "Cyberpunk industrial walls, cables, pipes, neon strips, dark metal",
                grid_size: 3
            }
        ],
        style_anchor: "cyberpunk, dark, neon, high quality, consistent game art",
        output_dir_name: "assets"
    };

    console.log("[AGENT] Generating Assets via Pollinations (FREE)...");
    try {
        const invocation = (assetTool as any).createInvocation(assetsParams);
        const result = await invocation.execute(new AbortController().signal);
        console.log("[SUCCESS] Assets generated:", result.returnDisplay);
    } catch (error) {
        console.error("[CRITICAL ERROR] Asset generation failed:", error);
    }

    // Phase 5: Generate Tilemap
    console.log("[AGENT] Generating Tilemap JSON...");
    const tilemapParams = {
        tileset_key: "ruins_floor",
        tile_size: 64,
        tileset_grid_size: 3,
        mode: "floor",
        maps: [
            {
                map_key: "ruins_hub",
                layout_ascii: [
                    "XXXXXXXXXXXXXXXXXXXX",
                    "X#...............#EX",
                    "X..................X",
                    "X..........#.......X",
                    "X..........E.......X",
                    "X#................#X",
                    "X..................X",
                    "X..........#.......X",
                    "X..........E.......X",
                    "X..................X",
                    "X................#EX",
                    "XXXXXXXXXXXXXXXXXXXX"
                ],
                legend: { "X": 0, "#": 1, ".": 0, "E": 0 },
                object_markers: { "E": "enemy_spawn" }
            }
        ],
        output_dir_name: "assets"
    };

    try {
        const invocation = (tilemapTool as any).createInvocation(tilemapParams);
        const result = await invocation.execute(new AbortController().signal);
        console.log("[SUCCESS] Tilemap generated:", result.returnDisplay);
    } catch (error) {
        console.error("[ERROR] Tilemap generation failed:", error);
    }

    console.log("--- End of ASSET GENERATION ---");
}

run().catch(console.error);
