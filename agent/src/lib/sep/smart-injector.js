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
        console.log("SmartInjector v2.1 (Bulletproof) loaded");
        let injectedHtml = this.goldenSeedHtml;
        const cfg = this.gameConfig || {};

        // 1. Inject GameConfig JSON directly into a script tag
        const configScript = `<script id="game-config-json" type="application/json">${JSON.stringify(cfg, null, 2)}</script>`;
        injectedHtml = injectedHtml.replace("<!-- GAME_CONFIG_INJECTION_POINT -->", configScript);

        // 2. Replace placeholders for specific values (with defaults)
        const title = cfg.gameTitle || "SmolGame";
        injectedHtml = injectedHtml.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);

        // 3. Inject dynamic values into JS variables within the Golden Seed
        const pColor = cfg.player?.color || "#00FF00";
        const jHeight = cfg.player?.jumpHeight || 10;
        const djEnabled = cfg.player?.doubleJumpEnabled ?? true;
        const initialSpeed = cfg.difficulty?.curve?.[0]?.gameSpeed || 5;
        const maxSpeed = cfg.difficulty?.maxGameSpeed || 15;
        
        injectedHtml = injectedHtml.replace(/let PLAYER_COLOR = ".*?";/, `let PLAYER_COLOR = "${pColor}";`);
        injectedHtml = injectedHtml.replace(/let JUMP_HEIGHT = .*?;/, `let JUMP_HEIGHT = ${jHeight};`);
        injectedHtml = injectedHtml.replace(/let DOUBLE_JUMP_ENABLED = .*?;/, `let DOUBLE_JUMP_ENABLED = ${djEnabled};`);
        injectedHtml = injectedHtml.replace(/let INITIAL_SPEED = .*?;/, `let INITIAL_SPEED = ${initialSpeed};`);
        injectedHtml = injectedHtml.replace(/let MAX_SPEED = .*?;/, `let MAX_SPEED = ${maxSpeed};`);

        // Inject objects (Safely)
        const difficultyCurve = cfg.difficulty?.curve || [];
        const parallaxLayers = cfg.visuals?.parallaxLayers || [];
        const sfxMap = cfg.audio?.sfx || {};
        const obstacleColors = cfg.world?.obstacleTypes?.map(o => o.color) || ["#FF0000"];

        injectedHtml = injectedHtml.replace(/let DIFFICULTY_CURVE = \[.*?\];/s, `let DIFFICULTY_CURVE = ${JSON.stringify(difficultyCurve, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let PARALLAX_LAYERS = \[.*?\];/s, `let PARALLAX_LAYERS = ${JSON.stringify(parallaxLayers, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let SFX_MAP = \{.*?\};/s, `let SFX_MAP = ${JSON.stringify(sfxMap, null, 2)};`);
        injectedHtml = injectedHtml.replace(/let OBSTACLE_COLORS = \[.*?\];/s, `let OBSTACLE_COLORS = ${JSON.stringify(obstacleColors, null, 2)};`);
        
        const sphereColor = cfg.world?.collectibleTypes?.[0]?.color || '#FFFF00';
        injectedHtml = injectedHtml.replace(/let SPHERE_COLOR = ".*?";/, `let SPHERE_COLOR = "${sphereColor}";`);

        // 4. Inject custom logic hooks from the Mechanics section
        if (cfg.mechanics) {
            Object.keys(cfg.mechanics).forEach(hookName => {
                const hookCode = cfg.mechanics[hookName];
                // Replace both with and without "//" prefix to be safe
                injectedHtml = injectedHtml.replace(`// ${hookName}`, hookCode);
                injectedHtml = injectedHtml.replace(hookName, hookCode);
            });
        }

        return injectedHtml;
    }
}


export { SmartInjector };
