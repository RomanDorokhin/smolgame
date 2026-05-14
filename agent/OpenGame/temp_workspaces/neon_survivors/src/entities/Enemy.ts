import Phaser from 'phaser';
import { BaseEnemy } from '../characters/BaseEnemy';

export class BasicEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: 'enemy_zombie_idle',
      stats: {
        maxHealth: 2,
        speed: 80,
        damage: 1,
      },
      ai: {
        type: 'chase',
        detectionRange: 400
      }
    });
  }
}

export class BossEnemy extends BaseEnemy {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, {
      textureKey: 'boss_drone_idle',
      stats: {
        maxHealth: 50,
        speed: 50,
        damage: 5,
      },
      ai: {
        type: 'chase',
        detectionRange: 800
      },
      displayHeight: 96
    });
  }
}