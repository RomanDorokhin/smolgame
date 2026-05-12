/* ═══════════════════════════════════════════════════
   BOSS: NEON DRAGON
═══════════════════════════════════════════════════ */

class BossDragon extends Phaser.GameObjects.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'enemyElite'); // Re-use elite texture for now

        this.scene = scene;
        this.hp = 1000;
        this.maxHp = 1000;
        this.state = 'CIRCLE'; 
        this.circleRadius = 250;
        this.circleSpeed = 0.002;
        this.circleAngle = 0;
        this.volleyCooldown = 0;
        this.volleyBullets = 12;
        this.bulletSpeed = 350;

        this.scene.add.existing(this);
        this.scene.physics.world.enable(this);
        this.body.setCollideWorldBounds(true);
        this.setDepth(20);
        this.setTint(0x00ffff);
        
        // Glow
        this.glow = this.scene.add.pointlight(x, y, 0x00ffff, 100, 0.6);
    }

    update(player, time, delta) {
        if (!this.active) return;
        
        this.glow.setPosition(this.x, this.y);

        switch (this.state) {
            case 'CIRCLE':
                this._updateCircle(player, delta);
                break;
            case 'VOLLEY':
                this._updateVolley(player, time, delta);
                break;
        }
    }

    _updateCircle(player, delta) {
        if (!player || !player.active) return;

        this.circleAngle += this.circleSpeed * delta;

        const targetX = player.x + Math.cos(this.circleAngle) * this.circleRadius;
        const targetY = player.y + Math.sin(this.circleAngle) * this.circleRadius;

        // Smooth move towards target
        this.x = Phaser.Math.Interpolation.Linear([this.x, targetX], 0.1);
        this.y = Phaser.Math.Interpolation.Linear([this.y, targetY], 0.1);

        this.rotation = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) + Math.PI/2;

        if (this.circleAngle >= Math.PI * 2) {
            this.circleAngle = 0;
            this.state = 'VOLLEY';
            this.volleyCooldown = 1500;
        }
    }

    _updateVolley(player, time, delta) {
        this.volleyCooldown -= delta;
        if (this.volleyCooldown <= 0) {
            this._fireVolley(player);
            this.state = 'CIRCLE';
        }
    }

    _fireVolley(player) {
        const startAngle = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y) - Math.PI / 4;
        const angleStep = (Math.PI / 2) / (this.volleyBullets - 1);

        for (let i = 0; i < this.volleyBullets; i++) {
            const angle = startAngle + angleStep * i;
            const b = this.scene.bullets.get(this.x, this.y);
            if (b) {
              b.setActive(true).setVisible(true).setDepth(8);
              b.body.reset(this.x, this.y);
              b.body.setVelocity(Math.cos(angle) * this.bulletSpeed, Math.sin(angle) * this.bulletSpeed);
              b.setRotation(angle + Math.PI / 2);
              b._born = this.scene.time.now;
            }
        }
        this.scene.cameras.main.shake(200, 0.01);
    }

    takeDamage(amount) {
        this.hp -= amount;
        this.setTint(0xffffff);
        this.scene.time.delayedCall(50, () => this.setTint(0x00ffff));
        
        if (this.hp <= 0) {
            this.glow.destroy();
            this.destroy();
        }
    }
}
