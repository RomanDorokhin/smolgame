/**
 * SMOL JUICE TOOLKIT
 * Essential functions for high-quality game feel.
 */

// 1. Safe Storage
const safeStorage = {
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e) {} },
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch(e) { return d; } }
};

// 2. Screen Shake
let _shake = 0;
function shake(amt = 10) { _shake = amt; }
function applyShake(ctx) {
  if (_shake > 0.1) {
    ctx.translate((Math.random()-0.5)*_shake, (Math.random()-0.5)*_shake);
    _shake *= 0.9;
  }
}

// 3. Simple Particle System
const particles = [];
function burst(x, y, color, count = 15) {
  for(let i=0; i<count; i++) {
    particles.push({
      x, y, color,
      vx: (Math.random()-0.5)*10,
      vy: (Math.random()-0.5)*10,
      life: 1, sz: 2+Math.random()*4
    });
  }
}
function updateParts(ctx) {
  for(let i=particles.length-1; i>=0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.life -= 0.02;
    ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.sz, p.sz);
    if(p.life <= 0) particles.splice(i, 1);
  }
  ctx.globalAlpha = 1;
}

// 4. Procedural Audio (Web Audio API)
let _AC;
const sfx = (f, d=0.1, v=0.1, type='square') => {
  try {
    const a = _AC || (_AC = new (window.AudioContext || window.webkitAudioContext)());
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(v, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
    o.connect(g); g.connect(a.destination);
    o.start(); o.stop(a.currentTime + d);
  } catch(e) {}
};
