
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
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scene: [Preloader, RuinsLevel, CorridorArena],
    parent: 'game-container'
};

new Phaser.Game(config);
