// Import Phaser library
import Phaser from 'phaser';

// Create game scene
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'phaser-example',
  width: 800,
  height: 600,
  scene: {
    preload: preload,
    create: create,
    update: update
  }
});

// Preload assets
function preload() {
  // Load player sprite
  this.load.setBaseURL('https://labs.phaser.io');
  this.load.setPath('src/games/firstgame/assets/');
  this.load.image('sky', 'sky.png');
  this.load.image('ground', 'platform.png');
  this.load.image('star', 'star.png');
  this.load.image('bomb', 'bomb.png');
  this.load.spritesheet('dude', 'dude.png', { frameWidth: 32, frameHeight: 48 });
}

// Create game objects
function create() {
  // Create player sprite
  this.add.image(400, 300, 'sky');
  const platforms = this.physics.add.staticGroup();
  platforms.create(400, 568, 'ground').setScale(2).refreshBody();
  platforms.create(600, 400, 'ground');
  platforms.create(50, 250, 'ground');
  platforms.create(750, 220, 'ground');
  this.player = this.physics.add.sprite(100, 450, 'dude');
  this.player.setBounce(0.2);
  this.player.setCollideWorldBounds(true);
  this.physics.add.collider(this.player, platforms);
  this.cursors = this.input.keyboard.createCursorKeys();
}

// Add game over screen
function gameOver() {
  this.gameOverText = this.add.text(400, 300, 'Game Over', { fontSize: 64, color: '#ffffff' });
}
