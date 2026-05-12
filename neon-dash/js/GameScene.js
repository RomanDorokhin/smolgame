class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.cameras.main.setBackgroundColor(C.bg);
    this.speed = GAME_SPEED_START;
    this.spawnRate = SPAWN_RATE_START;
    this.gameOver = false;
    
    // Lava Cracks (Background)
    this.grid = this.add.grid(400, 200, 1600, 800, 80, 80, 0x000000, 0, C.grid, 0.4);
    
    // Burning Floor
    this.floor = this.add.rectangle(400, 380, 800, 40, 0x330000);
    this.physics.add.existing(this.floor, true);
    this.add.rectangle(400, 362, 800, 4, 0xff4400).setAlpha(0.6); // Magma line

    // Crystal Player with sparks
    this.player = this.physics.add.sprite(150, 300, 'sphere');
    this.player.setBounce(0.1);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.floor);

    this.particles = this.add.particles(0, 0, 'part', {
      speed: 150,
      scale: { start: 1.5, end: 0 },
      alpha: { start: 0.8, end: 0 },
      blendMode: 'ADD',
      follow: this.player,
      tint: 0xff4400
    });

    // Obstacles
    this.obstacles = this.physics.add.group();
    this.physics.add.overlap(this.player, this.obstacles, this._onHit, null, this);

    // Input
    this.input.on('pointerdown', this._jump, this);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this._scheduleNextSpawn();

    this.score = 0;
    this.scoreText = this.add.text(30, 30, 'SOULS: 0', { 
      fontFamily: 'Impact', fontSize: '36px', color: '#ff4400',
      stroke: '#000', strokeThickness: 4
    });
  }

  update(time, delta) {
    if (this.gameOver) return;

    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this._jump();
    }

    this.speed += 0.08; // Harder faster

    // Move lava
    this.grid.x -= (this.speed * delta) / 1000;
    if (this.grid.x <= 0) this.grid.x = 400;

    // Move obstacles
    this.obstacles.getChildren().forEach(obj => {
      obj.x -= (this.speed * delta) / 1000;
      if (obj.x < -100) {
        obj.destroy();
        this.score += 1;
        this.scoreText.setText('SOULS: ' + this.score);
      }
    });
  }

  _jump() {
    if (this.player.body.touching.down) {
      this.player.setVelocityY(PLAYER_JUMP_FORCE);
      this.cameras.main.shake(150, 0.005);
    }
  }

  _scheduleNextSpawn() {
    if (this.gameOver) return;
    this.time.delayedCall(this.spawnRate, () => {
      this._spawnObstacle();
      this.spawnRate = Math.max(500, this.spawnRate - 10);
      this._scheduleNextSpawn();
    });
  }

  _spawnObstacle() {
    const isWall = Math.random() > 0.65;
    const type = isWall ? 'wall' : 'spike';
    const y = isWall ? 340 : 364;
    
    const obj = this.obstacles.create(900, y, type);
    obj.setOrigin(0.5, 1);
    obj.body.setAllowGravity(false);
    obj.body.setImmovable(true);
  }

  _onHit() {
    if (this.gameOver) return;
    this.gameOver = true;
    this.physics.pause();
    this.particles.stop();
    this.player.setTint(0x000000);
    this.cameras.main.shake(600, 0.05);
    this.cameras.main.flash(300, 255, 68, 0);

    this.add.text(400, 200, 'MELTED', { 
      fontFamily: 'Impact', fontSize: '80px', color: '#ff0000',
      stroke: '#000', strokeThickness: 8
    }).setOrigin(0.5);
    
    this.time.delayedCall(2000, () => {
      this.scene.restart();
    });
  }
}
