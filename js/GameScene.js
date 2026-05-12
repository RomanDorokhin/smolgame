/* ═══════════════════════════════════════════════════
   SCENE: GAME
═══════════════════════════════════════════════════ */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  /* ────────────────────────────────────────
     CREATE
  ──────────────────────────────────────── */
  create() {
    this._buildTextures();
    this._buildWorld();
    this._buildPlayer();
    this._buildGroups();
    this._buildUI();
    this._buildJoystick();
    this._buildInput();
    this._setupCollisions();
    this._setupAudio();

    // State
    this.score             = 0;
    this.kills             = 0;
    this.wave              = 1;
    this.shootTimer        = 0;
    this.hitstopActive     = false;
    this.gameOver          = false;
    this.invincibleTimer   = 0;
    this.shieldActive      = false;
    this.shieldCooldown    = 0;

    this._resetSpawnEvent();

    // Wave-up timer
    this.time.addEvent({
      delay: WAVE_DURATION,
      callback: this._nextWave,
      callbackScope: this,
      loop: true
    });

    this.cameras.main.fadeIn(400);
  }

  /* ────────────────────────────────────────
     UPDATE
  ──────────────────────────────────────── */
  update(time, delta) {
    if (this.gameOver) return;
    if (this.hitstopActive) return;

    this._updateInvincibility(delta);
    this._handleMovement();
    this._handleShooting(time);
    this._handleShield(time);
    this._updateBullets();
    this._updateEnemies();
    this._updateGlow(time);
    this._updateShield(time);
    this._updateBosses(time, delta);
    this._updateJoystickVisual();
    this._updateUI();
  }

  /* ════════════════════════════════════════
     TEXTURES
  ════════════════════════════════════════ */
  _buildTextures() {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // ── Player (sleek arrowhead) ──
    g.clear();
    g.fillStyle(C.playerGl, 0.12);
    g.fillCircle(28, 28, 26);
    g.fillStyle(C.player, 1);
    g.fillTriangle(28, 2, 52, 46, 28, 38);
    g.fillTriangle(28, 2, 4,  46, 28, 38);
    g.fillStyle(0xffffff, 0.55);
    g.fillTriangle(28, 8, 36, 30, 28, 26);
    g.lineStyle(2, 0x80ffff, 0.85);
    g.strokeTriangle(28, 2, 52, 46, 28, 38);
    g.strokeTriangle(28, 2, 4,  46, 28, 38);
    g.fillStyle(C.playerGl, 0.9);
    g.fillCircle(28, 42, 5);
    g.generateTexture('player', 56, 56);

    // ── Bullet ──
    g.clear();
    g.fillStyle(C.bulletGl, 0.4);
    g.fillEllipse(10, 10, 20, 20);
    g.fillStyle(C.bullet, 1);
    g.fillEllipse(10, 10, 10, 10);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(10, 10, 3);
    g.generateTexture('bullet', 20, 20);

    // ── Enemy — diamond ──
    g.clear();
    g.fillStyle(C.enemyGl, 0.2);
    g.fillCircle(22, 22, 21);
    g.fillStyle(C.enemy, 1);
    g.fillTriangle(22, 4, 40, 22, 22, 40);
    g.fillTriangle(22, 4, 4,  22, 22, 40);
    g.lineStyle(2, 0xff88aa, 0.9);
    g.strokeTriangle(22, 4, 40, 22, 22, 40);
    g.strokeTriangle(22, 4, 4,  22, 22, 40);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(22, 22, 5);
    g.generateTexture('enemy', 44, 44);

    // ── Enemy Elite — hexagon ──
    g.clear();
    g.fillStyle(0xff6600, 0.2);
    g.fillCircle(28, 28, 27);
    g.fillStyle(0xff6600, 1);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = 28 + 20 * Math.cos(a), py = 28 + 20 * Math.sin(a);
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath();
    g.fillPath();
    g.lineStyle(2, 0xffaa44, 1);
    g.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = 28 + 20 * Math.cos(a), py = 28 + 20 * Math.sin(a);
      i === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.closePath();
    g.strokePath();
    g.fillStyle(0xffffff, 0.4);
    g.fillCircle(28, 28, 6);
    g.generateTexture('enemyElite', 56, 56);

    // ── Joystick Base ──
    g.clear();
    g.lineStyle(3, C.joy, 0.45);
    g.strokeCircle(64, 64, 62);
    g.fillStyle(C.joy, 0.07);
    g.fillCircle(64, 64, 62);
    g.lineStyle(1, C.joy, 0.15);
    g.strokeCircle(64, 64, 38);
    g.generateTexture('joyBase', 128, 128);

    // ── Joystick Knob ──
    g.clear();
    g.fillStyle(C.joy, 0.30);
    g.fillCircle(30, 30, 30);
    g.fillStyle(C.joyKnob, 0.85);
    g.fillCircle(30, 30, 16);
    g.fillStyle(0x80ffff, 0.5);
    g.fillCircle(24, 24, 6);
    g.generateTexture('joyKnob', 60, 60);

    // ── Particle dot ──
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture('dot', 8, 8);

    g.destroy();
  }

  /* ════════════════════════════════════════
     WORLD
  ════════════════════════════════════════ */
  _buildWorld() {
    this.add.rectangle(W / 2, H / 2, W, H, C.bg);

    const grid = this.add.graphics();
    grid.lineStyle(1, C.grid, 1);
    for (let x = 0; x <= W; x += 48) { grid.lineBetween(x, 0, x, H); }
    for (let y = 0; y <= H; y += 48) { grid.lineBetween(0, y, W, y); }
    grid.setDepth(0);

    const border = this.add.graphics();
    border.lineStyle(6, C.border, 0.85);
    border.strokeRect(3, 3, W - 6, H - 6);
    border.lineStyle(2, C.player, 0.3);
    border.strokeRect(10, 10, W - 20, H - 20);
    border.setDepth(50);

    this.physics.world.setBounds(0, 0, W, H);

    const acc = this.add.graphics();
    acc.lineStyle(3, C.player, 0.7);
    const cs = 30;
    [[3, 3], [W - 3, 3], [3, H - 3], [W - 3, H - 3]].forEach(([cx, cy]) => {
      const sx = cx === 3 ? 1 : -1;
      const sy = cy === 3 ? 1 : -1;
      acc.beginPath();
      acc.moveTo(cx, cy + sy * cs);
      acc.lineTo(cx, cy);
      acc.lineTo(cx + sx * cs, cy);
      acc.strokePath();
    });
    acc.setDepth(51);
  }

  /* ════════════════════════════════════════
     PLAYER
  ════════════════════════════════════════ */
  _buildPlayer() {
    this.player = this.physics.add.sprite(W / 2, H / 2, 'player');
    this.player.setCollideWorldBounds(true);
    this.player.body.setDrag(PLAYER_DRAG);
    this.player.body.setMaxVelocity(PLAYER_MAX_SPEED, PLAYER_MAX_SPEED);
    this.player.body.setCircle(20, 8, 8);
    this.player.setDepth(10);
    this.player.hp = PLAYER_MAX_HP;

    this.playerGlow = this.add.graphics().setDepth(9);

    this.trailEmitter = this.add.particles(0, 0, 'dot', {
      lifespan: 280,
      speed: { min: 10, max: 40 },
      scale: { start: 0.55, end: 0 },
      alpha: { start: 0.7, end: 0 },
      tint: [C.playerGl, 0x0088ff],
      blendMode: 'ADD',
      emitting: false,
      frequency: 30,
    }).setDepth(8);

    this.killEmitter = this.add.particles(0, 0, 'dot', {
      lifespan: 600,
      speed: { min: 80, max: 250 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(12);
  }

  /* ════════════════════════════════════════
     GROUPS
  ════════════════════════════════════════ */
  _buildGroups() {
    this.bullets = this.physics.add.group({
      defaultKey: 'bullet',
      maxSize: 120,
      createCallback: (b) => {
        b.body.setCircle(6, 4, 4);
      }
    });
    this.enemies = this.physics.add.group();
    this.bosses  = this.add.group();
  }

  /* ════════════════════════════════════════
     UI
  ════════════════════════════════════════ */
  _buildUI() {
    const depth = 60;

    this.hpBarBg = this.add.graphics().setDepth(depth).setScrollFactor(0);
    this.hpBarBg.fillStyle(0x111133, 1);
    this.hpBarBg.fillRoundedRect(14, 14, 180, 18, 6);
    this.hpBarBg.lineStyle(1, C.player, 0.5);
    this.hpBarBg.strokeRoundedRect(14, 14, 180, 18, 6);

    this.hpBar = this.add.graphics().setDepth(depth + 1).setScrollFactor(0);
    this._redrawHpBar();

    this.hpLabel = this.add.text(16, 16, 'HP', {
      fontFamily: 'Courier New', fontSize: '11px', color: '#00ff88'
    }).setDepth(depth + 2).setScrollFactor(0);

    this.scoreText = this.add.text(W - 16, 14, 'SCORE: 0', {
      fontFamily: 'Courier New', fontSize: '18px', fontStyle: 'bold',
      color: '#ffff00',
      stroke: '#886600', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(depth).setScrollFactor(0);

    this.waveText = this.add.text(W / 2, 14, 'WAVE  1', {
      fontFamily: 'Courier New', fontSize: '18px', fontStyle: 'bold',
      color: '#ff88ff',
      stroke: '#440066', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(depth).setScrollFactor(0);

    this.killsText = this.add.text(16, 38, 'KILLS: 0', {
      fontFamily: 'Courier New', fontSize: '13px', color: '#ff4488'
    }).setDepth(depth).setScrollFactor(0);

    this.waveAnnounce = this.add.text(W / 2, H / 2 - 80, '', {
      fontFamily: 'Courier New', fontSize: '52px', fontStyle: 'bold',
      color: '#ff88ff',
      stroke: '#440066', strokeThickness: 5,
      shadow: { blur: 24, color: '#ff00ff', fill: true }
    }).setOrigin(0.5).setDepth(70).setScrollFactor(0).setAlpha(0);

    this._showWaveAnnounce(1);
  }

  _redrawHpBar() {
    const ratio = Math.max(0, this.player.hp / PLAYER_MAX_HP);
    const color = ratio < 0.3 ? C.hpLow : C.hp;
    this.hpBar.clear();
    this.hpBar.fillStyle(color, 1);
    this.hpBar.fillRoundedRect(15, 15, Math.floor(178 * ratio), 16, 5);
  }

  _showWaveAnnounce(wave) {
    this.waveAnnounce.setText(`WAVE  ${wave}`).setAlpha(1).setScale(1.5);
    this.tweens.add({
      targets: this.waveAnnounce,
      alpha: 0, scale: 1,
      duration: 1600, ease: 'Power2.easeOut'
    });
  }

  _updateUI() {
    this.scoreText.setText(`SCORE: ${this.score}`);
    this.killsText.setText(`KILLS: ${this.kills}`);
    this.waveText.setText(`WAVE  ${this.wave}`);
  }

  /* ════════════════════════════════════════
     VIRTUAL JOYSTICK
  ════════════════════════════════════════ */
  _buildJoystick() {
    this.joy = {
      active: false, id: null,
      bx: 0, by: 0,
      nx: 0, ny: 0,
      dx: 0, dy: 0,
      r: 62
    };

    this.joyBase = this.add.image(0, 0, 'joyBase')
      .setDepth(40).setAlpha(0).setScrollFactor(0);
    this.joyKnob = this.add.image(0, 0, 'joyKnob')
      .setDepth(41).setAlpha(0).setScrollFactor(0);

    this.input.on('pointerdown',      this._joyDown, this);
    this.input.on('pointermove',      this._joyMove, this);
    this.input.on('pointerup',        this._joyUp,   this);
    this.input.on('pointerupoutside', this._joyUp,   this);
  }

  _joyDown(ptr) {
    if (this.joy.active) return;
    this.joy.active = true;
    this.joy.id = ptr.id;
    this.joy.bx = ptr.x; this.joy.by = ptr.y;
    this.joy.nx = ptr.x; this.joy.ny = ptr.y;
    this.joy.dx = 0;     this.joy.dy = 0;
    this.joyBase.setPosition(ptr.x, ptr.y).setAlpha(1);
    this.joyKnob.setPosition(ptr.x, ptr.y).setAlpha(1);
  }

  _joyMove(ptr) {
    const j = this.joy;
    if (!j.active || ptr.id !== j.id) return;
    const ddx = ptr.x - j.bx, ddy = ptr.y - j.by;
    const dist  = Math.sqrt(ddx * ddx + ddy * ddy);
    const clamp = Math.min(dist, j.r);
    const angle = Math.atan2(ddy, ddx);
    j.nx = j.bx + Math.cos(angle) * clamp;
    j.ny = j.by + Math.sin(angle) * clamp;
    j.dx = Math.cos(angle) * (clamp / j.r);
    j.dy = Math.sin(angle) * (clamp / j.r);
    this.joyKnob.setPosition(j.nx, j.ny);
  }

  _joyUp(ptr) {
    const j = this.joy;
    if (!j.active || ptr.id !== j.id) return;
    j.active = false;
    j.dx = 0; j.dy = 0;
    this.joyBase.setAlpha(0);
    this.joyKnob.setAlpha(0);
  }

  _updateJoystickVisual() {
    if (this.joy.active) {
      const pulse = 0.82 + 0.18 * Math.sin(this.time.now / 140);
      this.joyKnob.setAlpha(pulse);
      this.joyBase.setAlpha(0.9 + 0.1 * Math.sin(this.time.now / 200));
    }
  }

  /* ════════════════════════════════════════
     INPUT
  ════════════════════════════════════════ */
  _buildInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
    this.wasd = this.input.keyboard.addKeys({
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
  }

  /* ════════════════════════════════════════
     AUDIO (Web Audio API)
  ════════════════════════════════════════ */
  _setupAudio() {
    try {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      this._audioCtx = null;
    }
  }

  _playTone(freq, type, dur, vol, delay = 0) {
    if (!this._audioCtx) return;
    try {
      const ctx = this._audioCtx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, ctx.currentTime + delay);
      gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + delay + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + dur);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + dur + 0.01);
    } catch (e) {}
  }

  _sndShoot()      { this._playTone(900, 'square', 0.05, 0.06); this._playTone(600, 'sawtooth', 0.04, 0.03, 0.01); }
  _sndHit()        { this._playTone(180, 'square', 0.07, 0.1);  this._playTone(120, 'sawtooth', 0.05, 0.08, 0.02); }
  _sndKill()       { this._playTone(440, 'square', 0.06, 0.1);  this._playTone(880, 'sine', 0.1, 0.09, 0.02); this._playTone(220, 'sawtooth', 0.08, 0.07, 0.05); }
  _sndPlayerHurt() { this._playTone(160, 'sawtooth', 0.18, 0.15); this._playTone(80, 'square', 0.14, 0.12, 0.05); }
  _sndDeath() {
    for (let i = 0; i < 4; i++) {
      this._playTone(300 - i * 60, 'sawtooth', 0.2, 0.12, i * 0.08);
    }
  }

  /* ════════════════════════════════════════
     COLLISIONS
  ════════════════════════════════════════ */
  _setupCollisions() {
    this.physics.add.overlap(this.bullets, this.enemies, this._onBulletHitEnemy, null, this);
    this.physics.add.overlap(this.bullets, this.bosses, this._onBulletHitBoss, null, this);
    this.physics.add.collider(this.player, this.enemies, this._onPlayerHitEnemy, null, this);
  }

  /* ════════════════════════════════════════
     MOVEMENT
  ════════════════════════════════════════ */
  _handleMovement() {
    let ax = 0, ay = 0;

    if (this.cursors.left.isDown  || this.wasd.left.isDown)  ax -= PLAYER_ACCEL;
    if (this.cursors.right.isDown || this.wasd.right.isDown) ax += PLAYER_ACCEL;
    if (this.cursors.up.isDown    || this.wasd.up.isDown)    ay -= PLAYER_ACCEL;
    if (this.cursors.down.isDown  || this.wasd.down.isDown)  ay += PLAYER_ACCEL;

    const j = this.joy;
    if (j.active && (j.dx !== 0 || j.dy !== 0)) {
      ax = j.dx * PLAYER_ACCEL;
      ay = j.dy * PLAYER_ACCEL;
    }

    this.player.body.setAcceleration(ax, ay);

    // Smooth rotation toward movement direction
    if (ax !== 0 || ay !== 0) {
      const targetAngle = Math.atan2(ay, ax) + Math.PI / 2;
      const curr = this.player.rotation;
      const diff = Phaser.Math.Angle.Wrap(targetAngle - curr);
      this.player.setRotation(curr + diff * 0.22);
    }

    // Engine trail
    const speed = Math.sqrt(
      this.player.body.velocity.x ** 2 + this.player.body.velocity.y ** 2
    );
    if (speed > 60) {
      this.trailEmitter.setPosition(this.player.x, this.player.y);
      this.trailEmitter.emitParticle(1);
    }
  }

  /* ════════════════════════════════════════
     SHOOTING (auto-aim nearest enemy)
  ════════════════════════════════════════ */
  _handleShooting(time) {
    if (time < this.shootTimer) return;

    let nearest = null, nearDist = Infinity;
    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, e.x, e.y);
      if (d < nearDist) { nearDist = d; nearest = e; }
    });

    if (!nearest) return;

    this.shootTimer = time + BULLET_RATE;
    const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, nearest.x, nearest.y);
    this._fireBullet(angle);

    // Muzzle recoil
    this.player.body.velocity.x -= Math.cos(angle) * 14;
    this.player.body.velocity.y -= Math.sin(angle) * 14;

    this._sndShoot();
  }

  _fireBullet(angle) {
    const b = this.bullets.get(this.player.x, this.player.y);
    if (!b) return;
    b.setActive(true).setVisible(true).setDepth(8);
    b.body.reset(this.player.x, this.player.y);
    b.body.setVelocity(
      Math.cos(angle) * BULLET_SPEED,
      Math.sin(angle) * BULLET_SPEED
    );
    b.setRotation(angle + Math.PI / 2);
    b._born = this.time.now;
  }

  _updateBullets() {
    const now = this.time.now;
    this.bullets.getChildren().forEach(b => {
      if (!b.active) return;
      if (b.x < -20 || b.x > W + 20 || b.y < -20 || b.y > H + 20 || now - b._born > BULLET_LIFETIME) {
        this._recycleBullet(b);
      }
    });
  }

  _recycleBullet(b) {
    b.setActive(false).setVisible(false);
    b.body.reset(-200, -200);
    b.body.setVelocity(0, 0);
  }

  /* ════════════════════════════════════════
     ENEMY SPAWNING & AI
  ════════════════════════════════════════ */
  _resetSpawnEvent() {
    if (this._spawnEvent) this._spawnEvent.remove();
    const rate = Math.max(350, 1600 - (this.wave - 1) * 120);
    this._spawnEvent = this.time.addEvent({
      delay: rate,
      callback: this._spawnEnemy,
      callbackScope: this,
      loop: true
    });
  }

  _nextWave() {
    if (this.gameOver) return;
    this.wave++;
    if (this.wave === 5) {
      this._spawnBoss();
    }
    this._resetSpawnEvent();
    this._showWaveAnnounce(this.wave);
    this.cameras.main.flash(300, 100, 0, 180);
  }

  _spawnEnemy() {
    if (this.gameOver) return;

    const side = Phaser.Math.Between(0, 3);
    const margin = 24;
    let x, y;
    if (side === 0)      { x = Phaser.Math.Between(0, W); y = -margin; }
    else if (side === 1) { x = W + margin; y = Phaser.Math.Between(0, H); }
    else if (side === 2) { x = Phaser.Math.Between(0, W); y = H + margin; }
    else                 { x = -margin; y = Phaser.Math.Between(0, H); }

    const isElite = this.wave >= 3 && Phaser.Math.Between(0, 4) === 0;
    const key     = isElite ? 'enemyElite' : 'enemy';

    const e = this.enemies.create(x, y, key);
    e.setDepth(7);
    e.hp        = Math.ceil((isElite ? 4 : ENEMY_BASE_HP) * (1 + (this.wave - 1) * 0.7));
    e.maxHp     = e.hp;
    e.speed     = ENEMY_BASE_SPEED + (this.wave - 1) * ENEMY_SPEED_SCALE + (isElite ? 20 : 0);
    e.isElite   = isElite;
    e._flashTmr = 0;
    e._wobble   = Math.random() * Math.PI * 2;

    const radius = isElite ? 22 : 18;
    e.body.setCircle(radius, (e.width - radius * 2) / 2, (e.height - radius * 2) / 2);
    e.body.setMaxVelocity(e.speed * 1.4, e.speed * 1.4);
  }

  _updateEnemies() {
    const px = this.player.x, py = this.player.y;

    this.enemies.getChildren().forEach(e => {
      if (!e.active) return;

      const angle = Phaser.Math.Angle.Between(e.x, e.y, px, py);
      e._wobble += 0.04;
      const wobbleAngle = angle + Math.sin(e._wobble) * 0.28;

      e.body.setAcceleration(
        Math.cos(wobbleAngle) * e.speed * 3.5,
        Math.sin(wobbleAngle) * e.speed * 3.5
      );

      if (e.body.speed > 20) {
        e.setRotation(
          Phaser.Math.Angle.Between(0, 0, e.body.velocity.x, e.body.velocity.y) + Math.PI / 2
        );
      }

      if (e._flashTmr > 0) {
        e._flashTmr -= this.game.loop.delta;
        if (e._flashTmr <= 0) e.clearTint();
      }
    });
  }

  /* ════════════════════════════════════════
     COLLISION CALLBACKS
  ════════════════════════════════════════ */
  _onBulletHitEnemy(bullet, enemy) {
    this._recycleBullet(bullet);
    this._damageEnemy(enemy, 1);
  }

  _onPlayerHitEnemy(player, enemy) {
    if (this.playerInvincible || this.shieldActive) return;

    const angle = Phaser.Math.Angle.Between(enemy.x, enemy.y, player.x, player.y);
    player.body.setVelocity(
      Math.cos(angle) * KNOCKBACK_FORCE,
      Math.sin(angle) * KNOCKBACK_FORCE
    );

    this._hurtPlayer(PLAYER_HURT_DMG);
    this._doHitstop(HITSTOP_HIT * 2);
    this.cameras.main.shake(180, 0.022);
    this.cameras.main.flash(120, 255, 0, 0);
    this._sndPlayerHurt();
  }

  _damageEnemy(enemy, dmg) {
    enemy.hp -= dmg;
    enemy.setTint(C.hitFlash);
    enemy._flashTmr = 90;

    if (enemy.hp <= 0) {
      this._killEnemy(enemy);
    } else {
      this._doHitstop(HITSTOP_HIT);
      this.cameras.main.shake(50, 0.006);
      this._sndHit();

      const angle = Phaser.Math.Angle.Between(this.player.x, this.player.y, enemy.x, enemy.y);
      enemy.body.setVelocity(
        Math.cos(angle) * 120,
        Math.sin(angle) * 120
      );
    }
  }

  _killEnemy(enemy) {
    const ex = enemy.x, ey = enemy.y;
    const pts = enemy.isElite ? 25 : 10;

    this.killEmitter.setTint(enemy.isElite ? 0xff6600 : C.enemy);
    this.killEmitter.emitParticleAt(ex, ey, enemy.isElite ? 18 : 10);

    const pop = this.add.text(ex, ey - 20, `+${pts}`, {
      fontFamily: 'Courier New', fontSize: enemy.isElite ? '22px' : '16px',
      fontStyle: 'bold', color: enemy.isElite ? '#ff8800' : '#ff4488',
      stroke: '#000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(65);
    this.tweens.add({
      targets: pop,
      y: pop.y - 50, alpha: 0,
      duration: 700, ease: 'Power2.easeOut',
      onComplete: () => pop.destroy()
    });

    this.score += pts;
    this.kills++;
    enemy.destroy();

    this._doHitstop(HITSTOP_KILL);
    this.cameras.main.shake(90, 0.012);
    this._sndKill();
  }

  /* ════════════════════════════════════════
     PLAYER HP
  ════════════════════════════════════════ */
  _hurtPlayer(dmg) {
    this.player.hp -= dmg;
    this.playerInvincible = true;
    this.invincibleTimer  = PLAYER_IFRAMES;

    this._redrawHpBar();

    this.tweens.add({
      targets: this.player,
      alpha: { from: 0.3, to: 1 },
      duration: 100,
      repeat: 5,
      yoyo: true,
    });

    if (this.player.hp <= 0) {
      this._triggerGameOver();
    }
  }

  _updateInvincibility(delta) {
    if (!this.playerInvincible) return;
    this.invincibleTimer -= delta;
    if (this.invincibleTimer <= 0) {
      this.playerInvincible = false;
      this.player.setAlpha(1);
    }
  }

  /* ════════════════════════════════════════
     GAME OVER
  ════════════════════════════════════════ */
  _triggerGameOver() {
    this.gameOver = true;
    this.physics.world.pause();
    this._sndDeath();
    if (this._spawnEvent) this._spawnEvent.remove();

    this.cameras.main.flash(500, 255, 0, 0);
    this.cameras.main.shake(600, 0.04);

    this.killEmitter.setTint(C.playerGl);
    this.killEmitter.emitParticleAt(this.player.x, this.player.y, 30);
    this.player.setVisible(false);

    this.time.delayedCall(700, () => this._showGameOverScreen());
  }

  _showGameOverScreen() {
    const ov = this.add.graphics().setDepth(80).setScrollFactor(0);
    ov.fillStyle(0x000000, 0.78);
    ov.fillRect(0, 0, W, H);

    const px = W / 2, py = H / 2;
    const panel = this.add.graphics().setDepth(81).setScrollFactor(0);
    panel.fillStyle(0x001133, 1);
    panel.fillRoundedRect(px - 210, py - 170, 420, 340, 20);
    panel.lineStyle(3, C.player, 1);
    panel.strokeRoundedRect(px - 210, py - 170, 420, 340, 20);

    const title = this.add.text(px, py - 100, 'ELIMINATED', {
      fontFamily: 'Courier New', fontSize: '42px', fontStyle: 'bold',
      color: '#ff1e5a',
      shadow: { blur: 15, color: '#ff0000', fill: true }
    }).setOrigin(0.5).setDepth(82).setScrollFactor(0);

    const s1 = this.add.text(px, py - 10, `FINAL SCORE: ${this.score}`, {
      fontFamily: 'Courier New', fontSize: '20px', color: '#ffff00'
    }).setOrigin(0.5).setDepth(82).setScrollFactor(0);

    const s2 = this.add.text(px, py + 24, `HOSTILES KILLED: ${this.kills}`, {
      fontFamily: 'Courier New', fontSize: '18px', color: '#ff4488'
    }).setOrigin(0.5).setDepth(82).setScrollFactor(0);

    const restartBtn = this.add.text(px, py + 100, '[ REBOOT SYSTEM ]', {
      fontFamily: 'Courier New', fontSize: '24px', fontStyle: 'bold',
      color: '#00ffff'
    }).setOrigin(0.5).setDepth(82).setScrollFactor(0).setInteractive();

    restartBtn.on('pointerover', () => restartBtn.setScale(1.1).setColor('#ffffff'));
    restartBtn.on('pointerout',  () => restartBtn.setScale(1).setColor('#00ffff'));
    restartBtn.on('pointerdown', () => {
      this.cameras.main.fadeOut(300);
      this.time.delayedCall(300, () => this.scene.restart());
    });

    this.tweens.add({
      targets: [title, s1, s2, restartBtn],
      alpha: { from: 0, to: 1 },
      y: '+=15',
      duration: 600, ease: 'Power2.easeOut',
      stagger: 150
    });
  }

  /* ════════════════════════════════════════
     POLISH & FX
  ════════════════════════════════════════ */
  _doHitstop(dur) {
    if (this.hitstopActive) return;
    this.hitstopActive = true;
    this.physics.world.pause();
    this.time.delayedCall(dur, () => {
      this.hitstopActive = false;
      if (!this.gameOver) this.physics.world.resume();
    });
  }

  _updateGlow(time) {
    this.playerGlow.clear();
    const pulse = 0.5 + 0.5 * Math.sin(time / 180);
    this.playerGlow.fillStyle(C.playerGl, 0.15 + pulse * 0.1);
    this.playerGlow.fillCircle(this.player.x, this.player.y, 40 + pulse * 12);
    this.playerGlow.lineStyle(2, C.player, 0.4 + pulse * 0.3);
    this.playerGlow.strokeCircle(this.player.x, this.player.y, 35 + pulse * 8);
  }

  _handleShield(time) {
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && time > this.shieldCooldown) {
      this._activateShield(time);
    }
  }

  _activateShield(time) {
    this.shieldActive = true;
    this.shieldCooldown = time + SHIELD_COOLDOWN;
    
    this.shieldGraphics = this.add.graphics().setDepth(11);
    
    this.time.delayedCall(SHIELD_DURATION, () => {
      this.shieldActive = false;
      if (this.shieldGraphics) this.shieldGraphics.destroy();
    });

    this.cameras.main.flash(200, 0, 255, 255, 0.3);
  }

  _updateShield(time) {
    if (!this.shieldActive || !this.shieldGraphics) return;

    this.shieldGraphics.clear();
    const pulse = 0.6 + 0.4 * Math.sin(time / 100);
    const color = C.shield;
    const sides = 6;
    const radius = 35 + Math.sin(time / 50) * 2;

    this.shieldGraphics.lineStyle(3, color, 0.8 * pulse);
    this.shieldGraphics.fillStyle(color, 0.2 * pulse);
    
    this.shieldGraphics.beginPath();
    for (let i = 0; i <= sides; i++) {
      const angle = (i * 2 * Math.PI / sides) - Math.PI / 2;
      const x = this.player.x + radius * Math.cos(angle);
      const y = this.player.y + radius * Math.sin(angle);
      if (i === 0) this.shieldGraphics.moveTo(x, y);
      else this.shieldGraphics.lineTo(x, y);
    }
    this.shieldGraphics.closePath();
    this.shieldGraphics.fillPath();
    this.shieldGraphics.strokePath();
  }

  _spawnBoss() {
    const boss = new BossDragon(this, W / 2, -100);
    this.bosses.add(boss);
    
    this.tweens.add({
      targets: boss,
      y: 150,
      duration: 2000,
      ease: 'Back.easeOut'
    });
  }

  _updateBosses(time, delta) {
    this.bosses.getChildren().forEach(b => {
      b.update(this.player, time, delta);
    });
  }

  _onBulletHitBoss(bullet, boss) {
    this._recycleBullet(bullet);
    boss.takeDamage(10);
    this.cameras.main.shake(100, 0.005);
  }
}
