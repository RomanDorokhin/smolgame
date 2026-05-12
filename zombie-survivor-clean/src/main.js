import Phaser from 'phaser';
import { config } from './config.js';
import { GameScene } from './scenes/GameScene.js';

// Добавляем сцены
config.scene = [GameScene];

// Создаём игру
new Phaser.Game(config);