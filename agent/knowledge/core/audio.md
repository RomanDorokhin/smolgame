# Skill: Audio Mastery (Web Audio API)

Asset-free procedural sound generation.

## 1. Context Initialization
- Create `AudioContext` only after a user interaction (tap/click).
- Check `ctx.state === 'suspended'` and call `ctx.resume()`.

## 2. Procedural SFX (Oscillators)
Use `OscillatorNode` for basic sounds:
- **Jump:** Short sweep from low to high frequency (Sine/Square).
- **Explosion:** White noise or random low frequency with fast gain decay.
- **Collect:** Short high-pitched beep (Triangle).

## 3. Volume Management
- Always use a `GainNode` to prevent clipping and for master volume.
- Use `exponentialRampToValueAtTime` for natural-sounding volume drops.

## 4. Silent in Demo
- If the game is in "Demo Mode" (auto-playing), sound should be muted or not initialized.
- Gameplay must always have audio feedback for key actions.

## 5. Implementation Pattern
```javascript
const sfx = (f, t, type='sine') => {
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, audioCtx.currentTime);
  o.connect(g); g.connect(audioCtx.destination);
  o.start();
  g.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + t);
  o.stop(audioCtx.currentTime + t);
};
```
