import Phaser from 'phaser';
import { _TemplatePlayer } from '../characters/_TemplatePlayer';
import gameConfig from '../gameConfig.json';

export class Player extends _TemplatePlayer {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Override specific settings if needed
    // The base _TemplatePlayer already loads from gameConfig.json
  }

  // Example: override playAnimation if you have different naming convention
  // But _TemplatePlayer's default implementation is usually fine
  
  protected override onDamageTaken(damage: number): void {
    super.onDamageTaken(damage);
    // Add extra effects like screen shake
    this.scene.cameras.main.shake(100, 0.01);
  }
}