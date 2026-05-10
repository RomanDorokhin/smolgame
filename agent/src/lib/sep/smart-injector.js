/**
 * Smart Injector for SmolGame Engine Pipeline (SEP)
 * This script takes a Golden Seed HTML template and a Game Configuration JSON,
 * and injects the JSON data into the template to produce a complete game HTML file.
 * It ensures that the AI's role is limited to generating data, not core game logic.
 */

class SmartInjector {
    constructor(goldenSeedHtml, gameConfigJson) {
        this.goldenSeedHtml = goldenSeedHtml;
        this.gameConfig = gameConfigJson;
    }

    inject() {
        let injectedHtml = this.goldenSeedHtml;

        // 1. Inject GameConfig JSON directly into a script tag
        const configScript = `<script id="game-config-json" type="application/json">${JSON.stringify(this.gameConfig, null, 2)}</script>`;
        injectedHtml = injectedHtml.replace("<!-- GAME_CONFIG_INJECTION_POINT -->", configScript);

        // 2. Replace placeholders for specific values (e.g., game title)
        injectedHtml = injectedHtml.replace(/<title>.*?<\/title>/, `<title>${this.gameConfig.gameTitle}</title>`);

        // 3. Inject dynamic values into JS variables within the Golden Seed
        // This assumes the Golden Seed has specific placeholders like `let PLAYER_COLOR = 'PLACEHOLDER_PLAYER_COLOR';`
        injectedHtml = injectedHtml.replace(/let PLAYER_COLOR = ".*?";/, `let PLAYER_COLOR = "${this.gameConfig.player.color}";`);
        injectedHtml = injectedHtml.replace(/let JUMP_HEIGHT = .*?;/, `let JUMP_HEIGHT = ${this.gameConfig.player.jumpHeight};`);
        injectedHtml = injectedHtml.replace(/let DOUBLE_JUMP_ENABLED = .*?;/, `let DOUBLE_JUMP_ENABLED = ${this.gameConfig.player.doubleJumpEnabled};`);
        injectedHtml = injectedHtml.replace(/let INITIAL_SPEED = .*?;/, `let INITIAL_SPEED = ${this.gameConfig.difficulty.curve[0].gameSpeed};`);
        injectedHtml = injectedHtml.replace(/let MAX_SPEED = .*?;/, `let MAX_SPEED = ${this.gameConfig.difficulty.maxGameSpeed};`);
        injectedHtml = injectedHtml.replace(/let DIFFICULTY_CURVE = \[.*?\];/s, `let DIFFICULTY_CURVE = ${JSON.stringify(this.gameConfig.difficulty.curve, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let PARALLAX_LAYERS = \[.*?\];/s, `let PARALLAX_LAYERS = ${JSON.stringify(this.gameConfig.visuals.parallaxLayers, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let SFX_MAP = \{.*?\};/s, `let SFX_MAP = ${JSON.stringify(this.gameConfig.audio.sfx, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let OBSTACLE_COLORS = \[.*?\];/s, `let OBSTACLE_COLORS = ${JSON.stringify(this.gameConfig.world.obstacleTypes.map(o => o.color), null, 2)};`);
        injectedHtml = injectedHtml.replace(/let SPHERE_COLOR = ".*?";/, `let SPHERE_COLOR = "${this.gameConfig.world.collectibleTypes[0]?.color || '#FFFF00'}";`);

        // 4. Inject custom logic hooks (if any, from Coder agent)
        // This assumes the Golden Seed has specific injection points for custom logic
        // Example: injectedHtml = injectedHtml.replace("// CUSTOM_UPDATE_LOGIC_HOOK", this.gameConfig.mechanics.customUpdateLogic || "");
        // For now, we'll assume the Golden Seed handles most logic based on config.

        return injectedHtml;
    }
}


export { SmartInjector };
