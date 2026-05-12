const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game-container',
    scene: [Preloader, Menu, Game],
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

class Preloader extends Phaser.Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        // Загрузка ресурсов
        this.load.setBaseURL('assets/');
        this.load.image('ship', 'ship.png');
        this.load.image('asteroid', 'asteroid.png');
        this.load.image('background', 'background.png');
    }

    create() {
        this.scene.start('Menu');
    }
}

class Menu extends Phaser.Scene {
    constructor() {
        super('Menu');
    }

    create() {
        this.add.text(400, 300, 'Space Miner', { fontSize: '48px', fill: '#fff' }).setOrigin(0.5);
        const startButton = this.add.text(400, 400, 'Start Game', { fontSize: '32px', fill: '#0f0' }).setOrigin(0.5);
        startButton.setInteractive();
        startButton.on('pointerdown', () => {
            this.scene.start('Game');
        });
    }
}

class Game extends Phaser.Scene {
    constructor() {
        super('Game');
    }

    create() {
        // Фон
        this.add.image(400, 300, 'background').setScale(2);
        
        // Игрок
        this.player = this.physics.add.sprite(400, 300, 'ship');
        this.player.setCollideWorldBounds(true);
        
        // Астероиды
        this.asteroids = this.physics.add.group();
        this.time.addEvent({
            delay: 1000,
            callback: this.spawnAsteroid,
            callbackScope: this,
            loop: true
        });
        
        // Управление
        this.cursors = this.input.keyboard.createCursorKeys();
        
        // Столкновения
        this.physics.add.collider(this.player, this.asteroids, this.hitAsteroid, null, this);
    }

    spawnAsteroid() {
        const x = Phaser.Math.Between(0, 800);
        const asteroid = this.asteroids.create(x, -50, 'asteroid');
        asteroid.setVelocityY(Phaser.Math.Between(50, 150));
    }

    hitAsteroid(player, asteroid) {
        asteroid.destroy();
        // Логика столкновения
    }

    update() {
        // Управление игроком
        this.player.setVelocity(0);
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-300);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(300);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-300);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(300);
        }
    }
}