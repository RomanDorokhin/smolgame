// game.js - Cyberpunk Brick Breaker

const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'game',
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    }
};

const game = new Phaser.Game(config);

let paddle;
let bricks;
let ball;
let cursors;
let powerUps;
let isPaddleLong = false;
let shakeDuration = 0;
let score = 0;
let scoreText;

// Создание изображения палки (Cyberpunk стиль)
function createPaddleImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 120;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#00f0ff');
    gradient.addColorStop(1, '#ff00ff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
}

// Создание изображения мяча (Cyberpunk стиль)
function createBallImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 20;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(10, 10, 0, 10, 10, 10);
    gradient.addColorStop(0, '#00f0ff');
    gradient.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(10, 10, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    return canvas.toDataURL();
}

// Создание изображения кирпича (Cyberpunk стиль)
function createBrickImage(color) {
    const canvas = document.createElement('canvas');
    canvas.width = 60;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px Courier New';
    ctx.fillText('0101', 15, 20);
    return canvas.toDataURL();
}

// Создание изображения power-up (Cyberpunk стиль)
function createPowerUpImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 30;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(30, 15);
    ctx.lineTo(15, 30);
    ctx.lineTo(0, 15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    return canvas.toDataURL();
}

function preload() {
    // Создаем и загружаем ассеты
    this.load.image('paddle', createPaddleImage());
    this.load.image('ball', createBallImage());
    this.load.image('powerUp', createPowerUpImage());
}

function create() {
    // Фон (тёмный с неоновыми линиями)
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0a0a1a, 1);
    graphics.fillRect(0, 0, 800, 600);

    // Неоновые линии на фоне
    for (let i = 0; i < 10; i++) {
        graphics.lineStyle(1, 0x00f0ff, 0.3);
        graphics.strokeLineShape(new Phaser.Geom.Line(
            Phaser.Math.Between(0, 800),
            Phaser.Math.Between(0, 600),
            Phaser.Math.Between(0, 800),
            Phaser.Math.Between(0, 600)
        ));
    }

    // Создание палки
    paddle = this.physics.add.image(400, 550, 'paddle');
    paddle.setCollideWorldBounds(true);
    paddle.setImmovable(true);

    // Создание мяча
    ball = this.physics.add.image(400, 500, 'ball');
    ball.setCollideWorldBounds(true);
    ball.setBounce(1, 1);
    ball.setVelocity(200, -200);

    // Создание кирпичей (неоновые цвета)
    bricks = this.physics.add.staticGroup();
    const brickColors = ['#00f0ff', '#ff00ff', '#00ff00'];
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 10; j++) {
            const brick = bricks.create(100 + j * 60, 50 + i * 30, 'brick');
            brick.setTexture(createBrickImage(brickColors[Phaser.Math.Between(0, 2)]));
        }
    }

    // Коллизии
    this.physics.add.collider(ball, paddle, hitPaddle, null, this);
    this.physics.add.collider(ball, bricks, hitBrick, null, this);

    // Power-ups
    powerUps = this.physics.add.group();
    this.physics.add.collider(paddle, powerUps, collectPowerUp, null, this);

    // Управление
    cursors = this.input.keyboard.createCursorKeys();
    this.input.on('pointermove', (pointer) => {
        if (pointer.isDown) {
            paddle.x = Phaser.Math.Clamp(pointer.x, paddle.width / 2, 800 - paddle.width / 2);
        }
    });

    // Текст счёта
    scoreText = this.add.text(400, 16, 'Score: 0', {
        fontFamily: 'Courier New',
        fontSize: '24px',
        fill: '#00f0ff',
        stroke: '#000000',
        strokeThickness: 2
    }).setOrigin(0.5);
}

function update() {
    // Управление палкой
    if (cursors.left.isDown) {
        paddle.setVelocityX(-500);
    } else if (cursors.right.isDown) {
        paddle.setVelocityX(500);
    } else {
        paddle.setVelocityX(0);
    }

    // Эффект тряски экрана
    if (shakeDuration > 0) {
        this.cameras.main.shake(100, 0.02);
        shakeDuration--;
    }

    // Проверка падения мяча
    if (ball.y > 600) {
        this.scene.restart();
        score = 0;
        scoreText.setText('Score: ' + score);
    }
}

function hitPaddle(ball, paddle) {
    // Изменение угла отскока
    const relativeHit = (ball.x - paddle.x) / paddle.width;
    ball.setVelocityX(relativeHit * 500);
}

function hitBrick(ball, brick) {
    brick.destroy();
    score += 10;
    scoreText.setText('Score: ' + score);
    shakeDuration = 10; // Длительность тряски

    // Шанс выпадения power-up
    if (Phaser.Math.FloatBetween(0, 1) < 0.15) {
        const powerUp = powerUps.create(brick.x, brick.y, 'powerUp');
        powerUp.setVelocity(0, 100);
    }
}

function collectPowerUp(paddle, powerUp) {
    powerUp.destroy();
    if (!isPaddleLong) {
        isPaddleLong = true;
        paddle.setScale(1.5, 1); // Увеличение палки
        this.time.delayedCall(10000, () => {
            paddle.setScale(1, 1); // Возврат к обычному размеру
            isPaddleLong = false;
        });
    }
}