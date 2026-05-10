/**
 * Smart Injector for SmolGame Engine Pipeline (SEP)
 * This script takes a Golden Seed HTML template and a Game Configuration JSON,
 * and injects the JSON data into the template to produce a complete game HTML file.
 */

class SmartInjector {
    constructor(goldenSeedHtml, gameConfigJson) {
        this.goldenSeedHtml = goldenSeedHtml;
        this.gameConfig = gameConfigJson;
    }

    inject() {
        console.log("SmartInjector v2.2 (Audit Refined) loaded");
        let injectedHtml = this.goldenSeedHtml;
        const cfg = this.gameConfig || {};

        const performReplace = (pattern, value, label) => {
            const oldHtml = injectedHtml;
            injectedHtml = injectedHtml.replace(pattern, value);
            if (oldHtml === injectedHtml) {
                console.warn(`[SmartInjector] Warning: Injection point missed for "${label}"`);
            }
        };

        // 1. Inject GameConfig JSON directly into a script tag
        const configScript = `<script id="game-config-json" type="application/json">${JSON.stringify(cfg, null, 2)}</script>`;
        performReplace("<!-- GAME_CONFIG_INJECTION_POINT -->", configScript, "CONFIG_JSON");

        // 2. Replace placeholders for specific values (with defaults)
        const title = cfg.gameTitle || "SmolGame";
        performReplace(/<title>.*?<\/title>/, `<title>${title}</title>`, "TITLE");

        // 3. Inject dynamic values into JS variables
        const pColor = cfg.player?.color || "#00FF00";
        const jHeight = cfg.player?.jumpHeight || 10;
        
        performReplace(/let PLAYER_COLOR = ".*?";/, `let PLAYER_COLOR = "${pColor}";`, "PLAYER_COLOR");
        performReplace(/let JUMP_HEIGHT = .*?;/, `let JUMP_HEIGHT = ${jHeight};`, "JUMP_HEIGHT");

        // 4. Inject custom logic hooks
        if (cfg.mechanics) {
            Object.entries(cfg.mechanics).forEach(([hookName, hookCode]) => {
                const patterns = [
                    new RegExp(`//\\s*${hookName}`, 'g'),
                    new RegExp(`${hookName}`, 'g')
                ];
                
                let matched = false;
                for (const p of patterns) {
                    if (p.test(injectedHtml)) {
                        injectedHtml = injectedHtml.replace(p, hookCode);
                        matched = true;
                        break;
                    }
                }

                if (!matched) {
                    console.warn(`[SmartInjector] Warning: Logic Hook "${hookName}" not found in template!`);
                }
            });
        }

        return injectedHtml;
    }
}

export { SmartInjector };
