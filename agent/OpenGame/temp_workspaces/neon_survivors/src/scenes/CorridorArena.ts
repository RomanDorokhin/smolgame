import Phaser from 'phaser';
import { BaseArenaScene } from './BaseArenaScene';
import { Player } from '../entities/Player';
import { BasicEnemy, BossEnemy } from '../entities/Enemy';

export class CorridorArena extends BaseArenaScene {
  constructor() {
    super('CorridorArena');
  }

  create() {
    this.createBaseElements();
    
    // Set boss threshold
    this.bossKillThreshold = 20;
  }

  update() {
    this.baseUpdate();
  }

  public override createBackground(): void {
    // Standard vertical scrolling corridor
    this.setupScrollingBg('corridor_bg');
  }

  public override createEntities(): void {
    this.player = new Player(this, this.screenWidth / 2, this.screenHeight - 100);
  }

  public override spawnEnemy(): any {
    const x = Phaser.Math.Between(50, this.screenWidth - 50);
    const y = -50; // Spawn off-screen top
    
    const enemy = new BasicEnemy(this, x, y);
    this.enemies.add(enemy);
    
    return enemy;
  }

  protected override onBossSpawn(): void {
    const boss = new BossEnemy(this, this.screenWidth / 2, -100);
    this.enemies.add(boss);
    
    // Announcement or effect could go here
    console.log('BOSS SPAWNED!');
  }
}