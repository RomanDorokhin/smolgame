class BootScene extends Phaser.Scene {
  constructor() { super('BootScene'); }

  create() {
    const g = this.add.graphics();

    // Background
    g.fillStyle(C.bg, 1);
    g.fillRect(0, 0, W, H);

    // Scanlines
    g.lineStyle(1, 0x0a0a44, 0.3);
    for (let y = 0; y < H; y += 4) {
      g.lineBetween(0, y, W, y);
    }

    // Neon border
    g.lineStyle(3, C.border, 1);
    g.strokeRect(4, 4, W - 8, H - 8);
    g.lineStyle(1, C.player, 0.4);
    g.strokeRect(10, 10, W - 20, H - 20);

    // Title
    this.add.text(W / 2, H / 2 - 120, 'NEON ARENA', {
      fontFamily: 'Courier New', fontSize: '72px', fontStyle: 'bold',
      color: '#00ffff',
      stroke: '#0033ff', strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ffff', blur: 32, fill: true }
    }).setOrigin(0.5);

    this.add.text(W / 2, H / 2 - 30, 'COMBAT SHOOTER', {
      fontFamily: 'Courier New', fontSize: '22px',
      color: '#ff88ff',
      stroke: '#880088', strokeThickness: 3,
    }).setOrigin(0.5);

    // Controls hint
    this.add.text(W / 2, H / 2 + 30, 'WASD / ARROWS  —  MOVE', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#aaaaff'
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 55, 'AUTO-AIM  •  SURVIVE THE WAVES', {
      fontFamily: 'Courier New', fontSize: '16px', color: '#aaaaff'
    }).setOrigin(0.5);
    this.add.text(W / 2, H / 2 + 80, 'TOUCH: VIRTUAL JOYSTICK', {
      fontFamily: 'Courier New', fontSize: '14px', color: '#666699'
    }).setOrigin(0.5);

    // Tap to start
    const startText = this.add.text(W / 2, H / 2 + 150, '[ TAP TO START ]', {
      fontFamily: 'Courier New', fontSize: '28px', fontStyle: 'bold',
      color: '#ffff00',
      stroke: '#886600', strokeThickness: 3,
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: { from: 1, to: 0.2 },
      duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
    });

    this.input.once('pointerdown', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('GameScene'));
    });
    this.input.keyboard.once('keydown', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(320, () => this.scene.start('GameScene'));
    });
  }
}
