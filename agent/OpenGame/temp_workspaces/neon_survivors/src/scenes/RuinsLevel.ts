import Phaser from 'phaser';
import { BaseLevelScene } from './BaseLevelScene';
import { Player } from '../entities/Player';
import { BasicEnemy } from '../entities/Enemy';

export class RuinsLevel extends BaseLevelScene {
  constructor() {
    super('RuinsLevel');
  }

  create() {
    this.createBaseElements();
  }

  update() {
    this.baseUpdate();
  }

  public override setupMapSize(): void {
    this.mapWidth = 20 * this.tileSize;
    this.mapHeight = 12 * this.tileSize;
  }

  public override createEnvironment(): void {
    this.map = this.make.tilemap({ key: 'ruins_hub' });
    this.floorTileset = this.map.addTilesetImage('ruins_floor', 'ruins_floor')!;
    this.wallsTileset = this.floorTileset; // Using same tileset for simplicity if needed
    
    this.floorLayer = this.map.createLayer('Ground', this.floorTileset, 0, 0)!;
    // BaseLevelScene expects wallsLayer, if not present in JSON we can create empty or use Ground
    this.wallsLayer = this.floorLayer; 
    this.wallsLayer.setCollisionByExclusion([-1]);
  }

  public override createEntities(): void {
    this.player = new Player(this, 100, 100);
    
    const enemy1 = new BasicEnemy(this, 400, 300);
    this.enemies.add(enemy1);
    
    const enemy2 = new BasicEnemy(this, 600, 200);
    this.enemies.add(enemy2);
  }
}