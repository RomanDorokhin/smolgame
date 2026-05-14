
import { Config } from './src/config/config.js';
import { GenerateTilemapTool } from './src/tools/generate-tilemap.ts';
import * as path from 'path';
import * as fs from 'fs/promises';

async function run() {
    console.log("--- OpenGame TILEMAP GENERATION Runner ---");

    const projectRoot = path.resolve(process.cwd(), '../..');
    const workspacePath = path.join(projectRoot, 'temp_workspaces/neon_survivors');
    
    const config = new Config({
        targetDir: workspacePath,
        cwd: process.cwd(),
        debugMode: true,
        projectRoot: projectRoot
    });

    await config.initialize();
    const tilemapTool = new GenerateTilemapTool(config);

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

    console.log("--- End of TILEMAP GENERATION ---");
}

run().catch(console.error);
