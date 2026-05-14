import * as fs from 'fs';
import * as path from 'path';

const WORKSPACE_DIR = '../../temp_workspaces/neon_survivors';
const SRC_DIR = path.join(WORKSPACE_DIR, 'src');

async function main() {
    console.log('--- OpenGame ASSEMBLY Runner ---');

    // 1. Create directory structure if missing
    const dirs = [
        path.join(SRC_DIR, 'entities'),
        path.join(SRC_DIR, 'scenes'),
    ];
    for (const dir of dirs) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    // 2. Read GDD to extract code blocks
    const gddPath = path.join(WORKSPACE_DIR, 'GAME_DESIGN.md');
    const gddContent = fs.readFileSync(gddPath, 'utf-8');

    // Extract JSON config
    const configMatch = gddContent.match(/```json\n([\s\S]*?)\n```/);
    if (configMatch) {
        const configJson = configMatch[1];
        fs.writeFileSync(path.join(SRC_DIR, 'gameConfig.json'), configJson);
        console.log('[SUCCESS] gameConfig.json updated');
    }

    // Extract TypeScript blocks
    const tsBlocks = gddContent.matchAll(/### \*\*([^*]+)\*\*\s*\n```typescript\n([\s\S]*?)\n```/g);
    for (const block of tsBlocks) {
        const title = block[1].trim();
        const code = block[2];

        // Map titles to files
        let filePath = '';
        if (title.includes('Player.ts')) filePath = path.join(SRC_DIR, 'entities', 'Player.ts');
        else if (title.includes('Enemy.ts')) filePath = path.join(SRC_DIR, 'entities', 'Enemy.ts');
        else if (title.includes('TilemapLevel.ts')) filePath = path.join(SRC_DIR, 'scenes', 'RuinsLevel.ts');
        else if (title.includes('ArenaLevel.ts')) filePath = path.join(SRC_DIR, 'scenes', 'CorridorArena.ts');

        if (filePath) {
            // Fix imports if necessary (e.g. gameConfig.json path)
            let finalCode = code;
            if (!finalCode.includes('import gameConfig')) {
                finalCode = `import gameConfig from "../gameConfig.json";\n` + finalCode;
            }
            // Remove Template imports if they don't exist yet, or keep them as references
            // For now, let's just write as is.
            fs.writeFileSync(filePath, finalCode);
            console.log(`[SUCCESS] Written ${path.basename(filePath)}`);
        }
    }

    // 3. Update Preloader to load the asset pack
    const preloaderPath = path.join(SRC_DIR, 'scenes', 'Preloader.ts');
    if (fs.existsSync(preloaderPath)) {
        let preloader = fs.readFileSync(preloaderPath, 'utf-8');
        // Replace pack loading logic
        if (preloader.includes('this.load.pack')) {
             console.log('[INFO] Preloader already loads asset pack');
        } else {
             // Basic injection
             preloader = preloader.replace('preload() {', 'preload() {\n        this.load.pack("asset-pack", "assets/asset-pack.json");');
             fs.writeFileSync(preloaderPath, preloader);
             console.log('[SUCCESS] Preloader updated');
        }
    } else {
        // Create basic Preloader if missing
        const basicPreloader = `
import Phaser from "phaser";

export class Preloader extends Phaser.Scene {
    constructor() {
        super("Preloader");
    }

    preload() {
        this.load.pack("asset-pack", "assets/asset-pack.json");
    }

    create() {
        this.scene.start("RuinsLevel");
    }
}
`;
        fs.writeFileSync(preloaderPath, basicPreloader);
        console.log('[SUCCESS] Created basic Preloader');
    }

    // 4. Update Main Entry point
    const mainTsPath = path.join(SRC_DIR, 'main.ts');
    const mainTs = `
import Phaser from "phaser";
import { Preloader } from "./scenes/Preloader";
import { RuinsLevel } from "./scenes/RuinsLevel";
import { CorridorArena } from "./scenes/CorridorArena";

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1536,
    height: 1024,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: [Preloader, RuinsLevel, CorridorArena],
    parent: 'game-container'
};

new Phaser.Game(config);
`;
    fs.writeFileSync(mainTsPath, mainTs);
    console.log('[SUCCESS] main.ts updated');

    console.log('--- ASSEMBLY COMPLETE ---');
}

main().catch(console.error);
