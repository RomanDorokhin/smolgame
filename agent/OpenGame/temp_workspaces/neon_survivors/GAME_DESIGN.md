Here’s a **Technical Game Design Document (GDD)** for your **Top-Down** game idea, structured strictly per your instructions. Since the user’s game idea is undefined, I’ve created a **prototype framework** for a **"Rogue-Lite Survival Shooter"** with **Tilemap/Arena hybrid mechanics** (e.g., *Hades*-like combat in arenas, *Dark Souls*-like exploration in tilemaps). Adjust archetypes/behaviors as needed.

---

# **Game Design Document (GDD)**
**Title**: *Neon Scourge* (Prototype)
**Archetype**: Top-Down (Hybrid Tilemap/Arena)
**Core Loop**: Explore tilemap hubs → Enter arenas → Survive combat → Ascend difficulty.

---

## **Section 0: Overview**
- **Genre**: Roguelike Action/Combat (Top-Down)
- **Themes**: Cyberpunk dystopia (neon-lit ruins, hostile AI).
- **Core Mechanics**:
  - **Tilemap Mode**: Linear progression, loot, enemy ambushes.
  - **Arena Mode**: Time-limited boss fights, permadeath.
  - **Combat**: Melee/dash/ranged (bullet-time mechanics).
- **Art Style**: Pixel-art (Tilemap) / Semi-realistic (Arena backgrounds).
- **Difficulty**: Scales via enemy stats, arena size, and enemy spawn rates.

---

## **Section 1: Asset Registry**
*(All assets follow the specified naming conventions.)*

### **Characters (Animation)**
| **Type**       | **Key**                     | **Frames**                          | **Notes**                          |
|----------------|-----------------------------|-------------------------------------|------------------------------------|
| **Player**     | `player_idle_front`         | `{front, back, side}` (1 frame each) | Base sprite.                       |
|                | `player_dash_front`         | `{front, back, side}`              | Dash animation.                    |
|                | `player_attack_melee`       | `{front, back, side}`              | Melee swing.                       |
| **Enemy (Basic)** | `enemy_zombie_idle`       | `{front, back, side}`              | Chases player.                     |
| **Enemy (Boss)** | `boss_drone_idle`         | `{front, back, side}`              | Arena-exclusive.                   |

### **Tilemap Assets**
| **Theme**      | **Asset Type**       | **Key**                  | **Tileset Size** | **Notes**                          |
|----------------|----------------------|--------------------------|------------------|------------------------------------|
| **Ruins**      | Tileset              | `ruins_floor`            | 3x3               | Seamless tiling.                   |
|                | Tileset              | `ruins_walls`            | 3x3               | Includes doors, crates.            |
|                | Obstacle             | `obstacle_crate`         | -                | Destructible (1-hit).              |
|                | Decoration           | `deco_neon_sign`         | -                | Static prop.                       |

### **Arena Assets**
| **Type**       | **Key**                  | **Resolution**       | **Notes**                          |
|----------------|--------------------------|----------------------|------------------------------------|
| **Background** | `arena_corridor`         | 1536x1024            | Seamless scrollable.               |
| **Boss**       | `boss_drone_idle`        | -                    | See **Characters** table.          |

### **Audio**
| **Type**       | **Key**                  | **Notes**                          |
|----------------|--------------------------|------------------------------------|
| **BGM**        | `bgm_ruins_loop`         | Play in Tilemap hubs.              |
|                | `bgm_arena_danger`       | Play in Arena mode.                |
| **SFX**        | `sfx_shoot`              | Player weapon fire.                 |
|                | `sfx_dash`               | Player dash sound.                 |
|                | `sfx_hurt`               | Enemy/player damage.                |

---

## **Section 2: Game Configuration**
*(Merge into `src/gameConfig.json`)*

```json
{
  "player": {
    "stats": {
      "health": 100,
      "speed": 300,
      "meleeDamage": 20,
      "rangedDamage": 15,
      "dashCooldown": 1.5,
      "dashDistance": 100
    },
    "combat": {
      "meleeRange": 50,
      "rangedRange": 300,
      "bulletSpeed": 500
    },
    "animKeys": {
      "idle": "player_idle_front",
      "dash": "player_dash_front",
      "attack": "player_attack_melee"
    }
  },
  "enemies": {
    "basic": {
      "stats": {
        "health": 30,
        "speed": 200,
        "attackDamage": 10
      },
      "aiType": "chase",
      "combatMode": "melee"
    },
    "boss": {
      "stats": {
        "health": 500,
        "speed": 150,
        "attackDamage": 30
      },
      "aiType": "patrol_attack",
      "combatMode": "ranged",
      "phases": [
        { "healthThreshold": 0.7, "newBehavior": "teleport" }
      ]
    }
  },
  "levels": {
    "tilemap": {
      "difficultyScale": {
        "enemyHealth": 1.1,
        "spawnRate": 1.2
      }
    },
    "arena": {
      "difficultyScale": {
        "bossHealth": 1.05,
        "enemyCount": 2
      }
    }
  },
  "score": {
    "enemyPoints": {
      "basic": 100,
      "boss": 2000
    },
    "completionBonus": 500
  }
}
```

---

## **Section 3: Entity Architecture**
*(Behavior composition for all entities.)*

### **Player (`Player.ts`)**
```typescript
import { TemplatePlayer } from "./TemplatePlayer";

export class Player extends TemplatePlayer {
  constructor() {
    super();
    this.textureKey = "player_idle_front";
    this.shootSound = "sfx_shoot";
    this.hurtSound = "sfx_hurt";
    this.dashSound = "sfx_dash";
    this.stats = gameConfig.player.stats;
    this.animKeys = gameConfig.player.animKeys;
    this.combat = {
      meleeRange: gameConfig.player.combat.meleeRange,
      rangedDamage: gameConfig.player.combat.rangedDamage
    };
    this.dashConfig = {
      cooldown: gameConfig.player.dashCooldown,
      distance: gameConfig.player.dashDistance
    };
  }

  // HOOK OVERRIDES
  playAnimation(key: string, direction: "front" | "back" | "side") {
    const animKey = `${key}_${direction}`;
    this.setAnimation(animKey, 1); // Single-frame animations
  }

  onDamageTaken(damage: number) {
    super.onDamageTaken(damage);
    this.camera.shake(0.1); // Screen shake
    this.playSound(this.hurtSound);
  }

  onDash() {
    this.playSound(this.dashSound);
    this.playAnimation("dash", this.direction);
  }
}
```

### **Enemy (`Enemy.ts`)**
```typescript
import { TemplateEnemy } from "./TemplateEnemy";

export class BasicEnemy extends TemplateEnemy {
  constructor() {
    super();
    this.aiType = "chase";
    this.stats = gameConfig.enemies.basic.stats;
    this.combatMode = "melee";
  }

  getAnimationKey(): string {
    const baseKey = "enemy_zombie_idle";
    return `${baseKey}_${this.direction}`;
  }
}

export class BossEnemy extends TemplateEnemy {
  constructor() {
    super();
    this.aiType = "patrol_attack";
    this.stats = gameConfig.enemies.boss.stats;
    this.combatMode = "ranged";
    this.phases = gameConfig.enemies.boss.phases;
  }

  getAnimationKey(): string {
    const baseKey = "boss_drone_idle";
    return `${baseKey}_${this.direction}`;
  }

  onPhaseChange(phase: number) {
    if (phase === 1) {
      this.setAnimation("boss_drone_teleport", 1);
    }
  }
}
```

### **Level Scenes**
#### **Tilemap Level (`TilemapLevel.ts`)**
```typescript
import { TemplateLevel } from "./TemplateLevel";

export class RuinsLevel extends TemplateLevel {
  setupMapSize() {
    this.width = 20; // Tiles
    this.height = 15;
  }

  createEnvironment() {
    this.generateTilemap("ruins_floor", 0, 0, this.width, this.height);
    this.generateTilemap("ruins_walls", 0, 0, this.width, this.height);
  }

  createEntities() {
    // Place obstacles
    this.addObstacle("obstacle_crate", 5, 8);
    this.addObstacle("obstacle_crate", 12, 5);

    // Spawn enemies (chase AI)
    this.addEnemy(BasicEnemy, 8, 3);
    this.addEnemy(BasicEnemy, 15, 10);
  }
}
```

#### **Arena Level (`ArenaLevel.ts`)**
```typescript
import { TemplateArena } from "./TemplateArena";

export class CorridorArena extends TemplateArena {
  createBackground() {
    this.background = new Background("arena_corridor", 1536, 1024);
  }

  createEntities() {
    this.spawnEnemy(BasicEnemy, 300, 500); // Spawn near player
    this.spawnEnemy(BasicEnemy, 1200, 800);
  }

  spawnEnemy(type: typeof BasicEnemy, x: number, y: number) {
    const enemy = new type();
    enemy.setPosition(x, y);
    enemy.setTarget(this.player);
    this.addEntity(enemy);
  }

  getSpawnInterval(): number {
    return 5; // Spawn every 5 seconds
  }

  onEnemyKilled(enemy: Enemy) {
    super.onEnemyKilled(enemy);
    this.score.add(enemy.type === "boss" ? 2000 : 100);
  }
}
```

---

## **Section 4: Level Design**
*(Hybrid Tilemap/Arena progression.)*

### **Tilemap Level: "Ruins Hub"**
**ASCII Map** (Template B):
```
XXXXXXXXXXXXXXXXXXXX
XO...............EOX
X.................OX
X...........O.......X
X...........E.......X
XO...............OX
X.................OX
X...........O.......X
X...........E.......X
X.................OX
X...............EOX
XXXXXXXXXXXXXXXXXXXX
```
- **`O` (Obstacles)**: Crates at `(5,8)`, `(12,5)`.
- **`E` (Enemies)**: BasicEnemies at `(8,3)`, `(15,10)`.
- **Generate Commands**:
  ```typescript
  generateTilemap("ruins_floor", 0, 0, 20, 15); // Floor
  generateTilemap("ruins_walls", 0, 0, 20, 15); // Walls
  ```

### **Arena Level: "Neon Corridor"**
- **Background**: `arena_corridor` (1536x1024, seamless).
- **Player Start**: `(768, 512)` (center).
- **Enemies**:
  - **BasicEnemy**: 2 spawns (random positions in bounds).
  - **BossEnemy**: Spawns after 20 seconds (phase 1: melee, phase 2: teleport).
- **Difficulty Scaling**:
  - Arena size increases by 10% per level.
  - Boss health scales by `1.05^x` (x = level).
- **Score**:
  - 100 pts per BasicEnemy, 2000 pts per Boss.

---

## **Section 5: Systems & Hooks**
*(Critical systems for hybrid gameplay.)*

### **1. Combat System**
- **Player**:
  - Melee: `this.combat.meleeRange` (hitbox).
  - Ranged: Projectiles with `this.combat.bulletSpeed`.
  - Dash: `this.dashConfig.distance` (invincibility frames).
- **Enemies**:
  - Chase AI: `this.setTarget(player)`.
  - Boss Phases: `onPhaseChange(phase)` hook.

### **2. Arena Mechanics**
- **Time Limit**: 120 seconds (countdown UI).
- **Win/Lose**:
  - **Win**: Kill boss or survive timer.
  - **Lose**: Player health <= 0.
- **Respawn**: Player revives with 50% health (Tilemap only).

### **3. Score & Difficulty**
- **Formula**:
  ```typescript
  totalScore = (enemiesKilled * points) + (level * 100) + (completionBonus);
  ```
- **Difficulty**:
  - Tilemap: Enemies spawn faster (`spawnRate * 1.2`).
  - Arena: Boss health scales (`bossHealth * 1.05`).

### **4. Visual Feedback**
- **Screen Shake**: Triggered on `onDamageTaken` (0.1s duration).
- **Particle Effects**:
  - Dash: Trail particles.
  - Melee: Hit sparkles.

---
**End of GDD.**
*(Adjust archetypes/behaviors to match your undefined game idea.)*