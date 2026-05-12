/* ═══════════════════════════════════════════════════
   NEON ARENA — Constants & Configuration
═══════════════════════════════════════════════════ */

const W = 900, H = 600;

/* ── Physics ── */
const PLAYER_ACCEL     = 2800;
const PLAYER_DRAG      = 1400;
const PLAYER_MAX_SPEED = 300;
const KNOCKBACK_FORCE  = 420;
const BULLET_SPEED     = 520;
const BULLET_RATE      = 160;
const BULLET_LIFETIME  = 1800;

/* ── Difficulty wave scaling ── */
const WAVE_DURATION    = 18000;
const ENEMY_BASE_HP    = 2;
const ENEMY_BASE_SPEED = 80;
const ENEMY_SPEED_SCALE= 8;
const ENEMY_HP_SCALE   = 2.0;

/* ── Abilities ── */
const SHIELD_DURATION  = 3000;
const SHIELD_COOLDOWN  = 10000;

/* ── Player ── */
const PLAYER_MAX_HP    = 100;
const PLAYER_IFRAMES   = 900;
const PLAYER_HURT_DMG  = 20;

/* ── Hit-stop ── */
const HITSTOP_KILL     = 55;
const HITSTOP_HIT      = 28;

/* ── Neon palette ── */
const C = {
  bg:       0x000814,
  grid:     0x050530,
  border:   0x0033ff,
  player:   0x00ffff,
  playerGl: 0x00ffff,
  bullet:   0xffff00,
  bulletGl: 0xffee00,
  enemy:    0xff1e5a,
  enemyGl:  0xff1e5a,
  hitFlash: 0xffffff,
  joy:      0x00ffff,
  joyKnob:  0xffffff,
  hp:       0x00ff88,
  hpLow:    0xff3344,
  score:    0xffff00,
  wave:     0xff88ff,
  kill:     0xff4488,
  shield:   0x00ffff,
};
