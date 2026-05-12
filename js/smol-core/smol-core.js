/**
 * Smol-Core: Core Engine Library for SmolGame Engine Pipeline (SEP)
 * Provides highly optimized, production-ready utilities for Game AI Agents.
 * This version includes full support for State, Storage, Audio, Input, Physics, Render, Effects, Social, and Assets.
 */

const Smol = (function() {
  const S = {};
  
  let canvas, ctx;
  let W, H, GY;
  let frame = 0;
  let lastTime = 0;
  let deltaTime = 0;
  
  // ==========================================
  // 1. INIT & CORE LOOP
  // ==========================================
  S.init = function(canvasId, options = {}) {
    canvas = document.getElementById(canvasId);
    if (!canvas) throw new Error("Smol-Core: Canvas not found");
    ctx = canvas.getContext("2d");
    
    // Auto-resize
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      GY = H * (options.groundYRatio || 0.76); // Default ground Y ratio
      if (options.onResize) options.onResize(W, H, GY);
      S.W = W; S.H = H; S.GY = GY;
    };
    window.addEventListener("resize", resize);
    resize();
    
    // Disable touch actions on canvas to prevent browser scrolling/zooming
    canvas.style.touchAction = "none";
    
    S.ctx = ctx;
    S.W = W;
    S.H = H;
    S.GY = GY;
    
    // Start game loop
    const gameLoop = (currentTime) => {
      deltaTime = (currentTime - lastTime) / 1000; // Convert to seconds
      lastTime = currentTime;
      frame++;
      
      if (options.update) options.update(deltaTime, frame);
      if (options.render) options.render(ctx, W, H, GY, frame);
      
      S.Effects.updateParticles(deltaTime);
      S.Render.applyPostProcessing();

      requestAnimationFrame(gameLoop);
    };
    requestAnimationFrame(gameLoop);
    
    return { W, H, GY, ctx };
  };

  S.dims = () => ({ W, H, GY });
  S.getFrame = () => frame;
  S.getDeltaTime = () => deltaTime;

  // ==========================================
  // 2. STATE MACHINE
  // ==========================================
  S.State = {
    current: "intro",
    listeners: {},
    on(stateName, callback) {
      if (!this.listeners[stateName]) this.listeners[stateName] = [];
      this.listeners[stateName].push(callback);
    },
    set(newState) {
      if (this.current === newState) return;
      console.log(`Smol.State: ${this.current} -> ${newState}`);
      this.current = newState;
      if (this.listeners[newState]) {
        this.listeners[newState].forEach(cb => cb());
      }
    },
    is(stateName) { return this.current === stateName; }
  };

  // ==========================================
  // 3. STORAGE (Safe wrapper for localStorage)
  // ==========================================
  S.Storage = {
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn("Smol.Storage: Failed to set item", e); }
    },
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : def;
      } catch(e) { console.warn("Smol.Storage: Failed to get item", e); return def; }
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch(e) { console.warn("Smol.Storage: Failed to remove item", e); }
    },
    clear() {
      try { localStorage.clear(); } catch(e) { console.warn("Smol.Storage: Failed to clear storage", e); }
    }
  };

  // ==========================================
  // 4. AUDIO (Web Audio API Procedural SFX & Music)
  // ==========================================
  let audioContext;
  let bgMusicSource;
  S.Audio = {
    init() {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        // Unlock audio on first user interaction
        const unlockAudio = () => {
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }
          window.removeEventListener('pointerdown', unlockAudio);
          window.removeEventListener('keydown', unlockAudio);
        };
        window.addEventListener('pointerdown', unlockAudio);
        window.addEventListener('keydown', unlockAudio);
      }
      return audioContext;
    },
    tone(f, d, v = 0.18, type = 'square', sweep = null) {
      try {
        const ac = this.init();
        const o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = type;
        o.frequency.setValueAtTime(f, ac.currentTime);
        if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, ac.currentTime + d);
        g.gain.setValueAtTime(v, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d); // Fade out
        o.start(); o.stop(ac.currentTime + d);
      } catch(e) { console.warn("Smol.Audio.tone: Failed to play tone", e); }
    },
    sfx: {
      jump: (dbl) => S.Audio.tone(dbl ? 580 : 360, 0.12, 0.12, 'square', dbl ? 880 : 580),
      die: () => {
        S.Audio.tone(280, 0.18, 0.16, 'sawtooth', 80);
        setTimeout(() => S.Audio.tone(110, 0.4, 0.18, 'sawtooth'), 200);
      },
      score: () => S.Audio.tone(1100, 0.04, 0.04, 'sine'),
      hit: () => S.Audio.tone(150, 0.1, 0.1, 'square', 50)
    },
    playMusic(url, loop = true, volume = 0.5) {
      if (bgMusicSource) { bgMusicSource.stop(); bgMusicSource = null; }
      this.init().then(ac => {
        S.Assets.loadAudio(url).then(buffer => {
          bgMusicSource = ac.createBufferSource();
          bgMusicSource.buffer = buffer;
          bgMusicSource.loop = loop;
          const gainNode = ac.createGain();
          gainNode.gain.value = volume;
          bgMusicSource.connect(gainNode);
          gainNode.connect(ac.destination);
          bgMusicSource.start(0);
        }).catch(e => console.error("Smol.Audio.playMusic: Failed to load music", e));
      }).catch(e => console.error("Smol.Audio.playMusic: Failed to init audio context", e));
    },
    stopMusic() {
      if (bgMusicSource) { bgMusicSource.stop(); bgMusicSource = null; }
    }
  };

  // ==========================================
  // 5. INPUT (Unified for Touch/Mouse/Keyboard)
  // ==========================================
  S.Input = {
    keys: {},
    taps: 0,
    actionListeners: [],
    bind(onAction) {
      if (onAction) this.actionListeners.push(onAction);

      window.addEventListener('keydown', e => {
        this.keys[e.code] = true;
        if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
          e.preventDefault();
          this.actionListeners.forEach(cb => cb());
        }
      });
      window.addEventListener('keyup', e => { this.keys[e.code] = false; });
      
      // Use pointerdown for unified touch/mouse
      canvas.addEventListener('pointerdown', e => {
        e.preventDefault(); // Prevent default touch behavior (e.g., scrolling)
        this.taps++;
        this.actionListeners.forEach(cb => cb());
      }, { passive: false });
    },
    isDown(code) { return !!this.keys[code]; }
  };

  // ==========================================
  // 6. PHYSICS (Basic Collision & Gravity)
  // ==========================================
  S.Physics = {
    // AABB collision with optional padding
    hits: (a, b, p = 0) =>
      a.x + p < b.x + b.w && a.x + a.w - p > b.x &&
      a.y + p < b.y + b.h && a.y + a.h - p > b.y,
    applyGravity: (entity, gravityStrength, deltaTime) => {
      entity.vy += gravityStrength * deltaTime;
      entity.y += entity.vy;
    }
  };

  // ==========================================
  // 7. RENDER & EFFECTS (Advanced Visuals)
  // ==========================================
  S.Render = {
    gl(color, blur) { ctx.shadowColor = color; ctx.shadowBlur = blur; },
    ngl() { ctx.shadowBlur = 0; },
    vignette() {
      ctx.save();
      const v = ctx.createRadialGradient(W/2, H/2, H*0.3, W/2, H/2, H*0.8);
      v.addColorStop(0, 'transparent');
      v.addColorStop(1, 'rgba(0,0,0,0.4)');
      ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
      ctx.restore();
    },
    scanlines(alpha = 0.03, spacing = 3) {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#000';
      for(let y = 0; y < H; y += spacing) ctx.fillRect(0, y, W, 1);
      ctx.restore();
    },
    // Post-processing stack
    postProcessingEffects: [],
    addPostProcessing(effectFn) { this.postProcessingEffects.push(effectFn); },
    applyPostProcessing() {
      this.postProcessingEffects.forEach(effect => effect());
    },
    // Text rendering with glow
    text(txt, x, y, color = '#FFF', size = 24, glowColor = '#0FF', glowBlur = 10) {
      ctx.save();
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;
      S.Render.gl(glowColor, glowBlur);
      ctx.fillText(txt, x, y);
      S.Render.ngl();
      ctx.restore();
    }
  };

  S.Effects = {
    particles: [],
    screenShake: { intensity: 0, duration: 0, x: 0, y: 0 },
    parallaxLayers: [],

    burst(x, y, count = 20, colors = ['#fff'], grav = true) {
      for (let i = 0; i < count; i++) {
        const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 8;
        this.particles.push({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
          sz: 2 + Math.random() * 4, life: 1,
          dec: 0.02 + Math.random() * 0.03,
          col: colors[Math.floor(Math.random() * colors.length)],
          grav: grav
        });
      }
    },
    updateParticles(deltaTime) {
      ctx.save();
      this.particles.forEach(p => {
        ctx.globalAlpha = p.life;
        S.Render.gl(p.col, 8); ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.sz / 2, p.y - p.sz / 2, p.sz, p.sz);
        p.x += p.vx; p.y += p.vy;
        if(p.grav) p.vy += 0.25; // Apply gravity to particles
        p.sz *= 0.96; p.life -= p.dec;
      });
      ctx.restore();
      this.particles = this.particles.filter(p => p.life > 0);
    },

    shakeScreen(intensity, duration) {
      this.screenShake.intensity = intensity;
      this.screenShake.duration = duration;
      this.screenShake.x = 0; this.screenShake.y = 0;
    },
    applyScreenShake() {
      if (this.screenShake.duration > 0) {
        ctx.save();
        this.screenShake.x = (Math.random() - 0.5) * this.screenShake.intensity;
        this.screenShake.y = (Math.random() - 0.5) * this.screenShake.intensity;
        ctx.translate(this.screenShake.x, this.screenShake.y);
        this.screenShake.duration -= S.getDeltaTime();
        if (this.screenShake.duration <= 0) {
          this.screenShake.intensity = 0; // Reset after duration
          ctx.restore(); // Restore context only when shake ends
        }
      }
    },

    addParallaxLayer(imgUrl, speed, yOffset = 0, alpha = 1) {
      this.parallaxLayers.push({ img: null, url: imgUrl, speed, yOffset, alpha, x1: 0, x2: W });
      S.Assets.loadImage(imgUrl).then(img => {
        this.parallaxLayers.find(layer => layer.url === imgUrl).img = img;
      });
    },
    renderParallax(baseSpeed = 1) {
      this.parallaxLayers.forEach(layer => {
        if (layer.img) {
          ctx.save();
          ctx.globalAlpha = layer.alpha;
          const layerSpeed = layer.speed * baseSpeed * S.getDeltaTime() * 60; // Adjust speed based on FPS
          layer.x1 -= layerSpeed;
          layer.x2 -= layerSpeed;

          if (layer.x1 < -layer.img.width) layer.x1 = layer.img.width - layerSpeed;
          if (layer.x2 < -layer.img.width) layer.x2 = layer.img.width - layerSpeed;

          ctx.drawImage(layer.img, layer.x1, layer.yOffset, layer.img.width, H - layer.yOffset);
          ctx.drawImage(layer.img, layer.x2, layer.yOffset, layer.img.width, H - layer.yOffset);
          ctx.restore();
        }
      });
    }
  };

  // ==========================================
  // 8. SOCIAL (Telegram Mini App Integration)
  // ==========================================
  S.Social = {
    init() {
      // Mock Telegram WebApp object for local testing
      if (!window.Telegram || !window.Telegram.WebApp) {
        window.Telegram = { WebApp: { 
          initDataUnsafe: { user: { first_name: "Test", id: 123 } },
          ready: () => console.log("Telegram WebApp ready (mock)"),
          expand: () => console.log("Telegram WebApp expand (mock)"),
          close: () => console.log("Telegram WebApp close (mock)"),
          HapticFeedback: { impactOccurred: (s) => console.log("HapticFeedback", s) },
          openTelegramLink: (url) => console.log("openTelegramLink", url),
          showPopup: (params) => console.log("showPopup", params),
          showConfirm: (text, cb) => { console.log("showConfirm", text); cb(true); },
          showScanQrPopup: (params, cb) => { console.log("showScanQrPopup", params); cb("mock_qr_data"); },
          isVersionAtLeast: (v) => true,
          setHeaderColor: (c) => console.log("setHeaderColor", c),
          setBackgroundColor: (c) => console.log("setBackgroundColor", c),
          MainButton: {
            text: "MAIN BUTTON",
            isVisible: false,
            setText: (t) => { this.text = t; console.log("MainButton setText", t); },
            show: () => { this.isVisible = true; console.log("MainButton show"); },
            hide: () => { this.isVisible = false; console.log("MainButton hide"); },
            onClick: (cb) => { this.onClickCallback = cb; console.log("MainButton onClick set"); },
            offClick: (cb) => { this.onClickCallback = null; console.log("MainButton offClick"); },
            showProgress: (l) => console.log("MainButton showProgress", l),
            hideProgress: () => console.log("MainButton hideProgress"),
            isActive: true,
            enable: () => { this.isActive = true; console.log("MainButton enable"); },
            disable: () => { this.isActive = false; console.log("MainButton disable"); }
          },
          CloudStorage: {
            setItem: (k, v, cb) => { console.log("CloudStorage setItem", k, v); cb(null, true); },
            getItem: (k, cb) => { console.log("CloudStorage getItem", k); cb(null, "mock_cloud_data"); },
            getItems: (k, cb) => { console.log("CloudStorage getItems", k); cb(null, { k: "mock_cloud_data" }); },
            getKeys: (cb) => { console.log("CloudStorage getKeys"); cb(null, ["mock_key"]); }
          }
        }};
      }
      Telegram.WebApp.ready();
      Telegram.WebApp.expand();
      console.log("Smol.Social: Telegram WebApp initialized.");
    },
    getUserInfo() {
      return Telegram.WebApp.initDataUnsafe.user;
    },
    submitScore(score, leaderboardName = 'default') {
      console.log(`Submitting score ${score} to ${leaderboardName}`);
      // Actual implementation would use Telegram.WebApp.sendData or a backend call
      Telegram.WebApp.CloudStorage.setItem(`score_${leaderboardName}`, score.toString(), (err, success) => {
        if (success) console.log("Score saved to CloudStorage");
        else console.error("Failed to save score to CloudStorage", err);
      });
      // Example of opening a Telegram link (e.g., to a bot for leaderboard)
      // Telegram.WebApp.openTelegramLink(`https://t.me/your_bot?start=leaderboard_${leaderboardName}`);
    },
    shareGame(text, imageUrl = null) {
      const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text)}`;
      Telegram.WebApp.openTelegramLink(shareUrl);
    },
    inviteFriends(text) {
      const inviteUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(text || "Come play this awesome game!")}`;
      Telegram.WebApp.openTelegramLink(inviteUrl);
    },
    showMainButton(text, onClickCallback) {
      Telegram.WebApp.MainButton.setText(text);
      Telegram.WebApp.MainButton.show();
      Telegram.WebApp.MainButton.onClick(onClickCallback);
    },
    hideMainButton() {
      Telegram.WebApp.MainButton.hide();
      Telegram.WebApp.MainButton.offClick();
    },
    showConfirm(message, callback) {
      Telegram.WebApp.showConfirm(message, callback);
    },
    showPopup(params) {
      Telegram.WebApp.showPopup(params);
    }
  };

  // ==========================================
  // 9. ASSETS (Dynamic Loading & AI Generation Integration)
  // ==========================================
  const assetCache = {};
  S.Assets = {
    loadImage(url) {
      if (assetCache[url]) return Promise.resolve(assetCache[url]);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { assetCache[url] = img; resolve(img); };
        img.onerror = reject;
        img.src = url;
      });
    },
    loadAudio(url) {
      if (assetCache[url]) return Promise.resolve(assetCache[url]);
      return S.Audio.init().then(ac => {
        return fetch(url)
          .then(response => response.arrayBuffer())
          .then(arrayBuffer => ac.decodeAudioData(arrayBuffer))
          .then(audioBuffer => { assetCache[url] = audioBuffer; return audioBuffer; });
      });
    },
    // Programmatic generation (Placeholder for real AI integration)
    generateImage(prompt, style = 'pixelart') {
      // Create a deterministic color based on the prompt
      let hash = 0;
      for (let i = 0; i < prompt.length; i++) hash = prompt.charCodeAt(i) + ((hash << 5) - hash);
      const color = `hsl(${Math.abs(hash) % 360}, 70%, 50%)`;
      
      // Return a 1x1 colored pixel as a data URL (canvas can scale this)
      const canvas = document.createElement('canvas');
      canvas.width = 32; canvas.height = 32;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 32, 32);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(0,0,16,16); // Simple pattern
      return Promise.resolve(canvas.toDataURL());
    },
    generateAudio(prompt, type = 'sfx') {
      // Return a generated tone function
      return Promise.resolve(() => S.Audio.tone(400 + (prompt.length * 10), 0.2));
    }
  };

  return S;
})();

window.Smol = Smol;
