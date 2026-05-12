class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // Fire Crystal Player (Diamond shape)
    g.clear();
    g.fillStyle(0xff8800, 1);
    g.beginPath();
    g.moveTo(16, 0);
    g.lineTo(32, 16);
    g.lineTo(16, 32);
    g.lineTo(0, 16);
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xffff00, 1);
    g.strokePath();
    g.generateTexture('sphere', 32, 32);

    // Obsidian Spikes (Jagged)
    g.clear();
    g.fillStyle(C.spike, 1);
    g.beginPath();
    g.moveTo(16, 0);
    g.lineTo(28, 32);
    g.lineTo(4, 32);
    g.closePath();
    g.fillPath();
    g.lineStyle(1, 0x000000, 1);
    g.strokePath();
    g.generateTexture('spike', 32, 32);

    // Magma Wall
    g.clear();
    g.fillStyle(C.wall, 1);
    g.fillRect(0, 0, 32, 80);
    g.fillStyle(0xffaa00, 0.3);
    g.fillRect(4, 4, 24, 72);
    g.generateTexture('wall', 32, 80);

    // Red Sparks (Trail)
    g.clear();
    g.fillStyle(0xff0000, 1);
    g.fillCircle(2, 2, 2);
    g.generateTexture('part', 4, 4);

    this.scene.start('GameScene');
  }
}
