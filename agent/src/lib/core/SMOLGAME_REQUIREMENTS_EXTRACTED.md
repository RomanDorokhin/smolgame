# SmolGame Requirements - Extracted from v2.0 Documentation

## Platform Overview
- **SmolGame**: TikTok for browser games
- Games hosted on GitHub Pages (static only)
- User watches games in feed, taps to play
- Developers create games via algorithm + user feedback
- **Core principle**: Algorithm and users decide what's good, not developers

## Complete Game Checklist (35 Requirements)

### Technical Requirements (12)
1. ✅ **No backend** - Only static. No server requests during gameplay.
2. ✅ **Works in iframe** - Launches without errors. X-Frame-Options doesn't block.
3. ✅ **Touch control** - All game actions via touch. Mouse optional.
4. ✅ **Portrait orientation** - Vertical only. Horizontal not allowed.
5. ❌ **No system dialogs** - No alert(), confirm(), prompt() - blocks Telegram WebApp.
6. ❌ **No native keyboard** - No input/textarea fields - breaks mobile layout.
7. ❌ **No X-Frame-Options blocking** - Don't add headers blocking iframe.
8. ❌ **No flashing >3/sec** - Rapid flashing causes epileptic seizures.

### Gameplay (8)
9. ✅ **Screen in first 3 seconds** - Character moves, arms fly, blocks fall.
10. ✅ **Honest Game Over** - User understands why they lost. Visual feedback + sound + text.
11. ⚠️ **Difficulty balance** - First level not too easy, not too hard.
12. ✅ **No obvious bugs** - Double tap, fast swipes, multitap handled.
13. ✅ **Replayability** - Reason to play again - records, different paths.
14. ✅ **Tutorial** - If non-standard mechanics - short hint in gameplay.
15. ✅ **Progress visible** - User knows progress tied to device, can reset.
16. ✅ **Smooth gameplay** - Start to finish without lag/crashes.

### UX & Mobile (7)
17. ✅ **Tap zone minimum 44x44px** - Buttons/zones where needed.
18. ✅ **Font minimum 16px** - Readable in bright sunlight.
19. ✅ **Contrast** - Text/elements visible in bright light.
20. ✅ **Sound after tap** - Only after first user tap. Demo Mode always silent.
21. ✅ **Sound in gameplay** - Required in game mode (not demo).
22. ⚠️ **Performance** - Smooth on budget Android phones, not just flagships.
23. ✅ **Multitap** - Game handles multiple simultaneous touches.

### Progress & Data (3)
24. ✅ **Records** - Best result saved via localStorage.
25. ✅ **Progress** - For long games - progress saved via localStorage.
26. ✅ **Warning** - User knows progress tied to device, can reset.

### Visual & Atmosphere (5)
27. ⚠️ **Own style** - Game has visual character - color scheme, atmosphere, feeling.
28. ⚠️ **Game name visible** - Name visible inside game, not just in card.
29. ⚠️ **Preview image** - Static card image for catalog/search (not demo).
30. ✅ **Language** - Russian or visual-only (no text mixing).
31. ❌ **Content** - No 18+, violence, politics. Telegram has children.

### Demo Mode (5)
32. ✅ **Real gameplay** - Not static image, not scripted animation.
33. ✅ **Loopable** - Loops after completion.
34. ✅ **Any moment** - Can start from any game moment.
35. ✅ **Triggered by ?demo=1** - URL parameter launches demo.

---

## Critical Insights

### What Makes a Good Game
1. **Instant action** - Something happens in first 3 seconds
2. **Clear feedback** - User always knows what happened and why
3. **Fair difficulty** - Not too easy, not impossible
4. **Replayability** - Reason to play again
5. **Polish** - No bugs, handles edge cases

### What Kills a Game
1. **Blank screen** - Nothing happens
2. **Confusing feedback** - User doesn't understand what happened
3. **Unresponsive controls** - Taps don't work or lag
4. **Broken Game Over** - User doesn't know why they lost
5. **Unfair difficulty** - Feels rigged or impossible

### Demo Mode is Critical
- **Not optional** - Game won't be published without it
- **Real gameplay** - Not a video, not a static image
- **Loopable** - Must cycle smoothly
- **Silent** - Demo never has sound
- **Any moment** - Can start mid-game

---

## Validation Checklist for Generated Games

### Before Publishing (Must Have)
- [ ] Runs in iframe without errors
- [ ] Touch controls work (no mouse required)
- [ ] Portrait orientation only
- [ ] No alert/confirm/prompt
- [ ] No input fields
- [ ] No X-Frame-Options header
- [ ] No flashing >3/sec
- [ ] Sound only after first tap
- [ ] Demo Mode works (?demo=1)
- [ ] Game Over screen shows result
- [ ] No system dialogs
- [ ] Records saved to localStorage
- [ ] Progress saved to localStorage
- [ ] Multitap handled correctly
- [ ] Minimum 44x44px tap zones
- [ ] Font minimum 16px
- [ ] Good contrast in bright light
- [ ] Smooth performance on budget phones
- [ ] Russian or visual-only language
- [ ] No 18+/violence/politics content

### Quality Checks
- [ ] Something happens in first 3 seconds
- [ ] Clear Game Over feedback
- [ ] Fair difficulty progression
- [ ] Reason to replay (records/different paths)
- [ ] No obvious bugs
- [ ] Handles edge cases (double tap, fast swipe, multitap)
- [ ] Visual character (own style)
- [ ] Game name visible in-game
- [ ] Tutorial if non-standard mechanics

---

## Implementation Priority

### Phase 1: Core (Non-negotiable)
1. No backend - static only
2. Works in iframe
3. Touch controls
4. Portrait orientation
5. No system dialogs
6. No native keyboard
7. Demo Mode
8. Game Over screen
9. localStorage support
10. Sound after tap

### Phase 2: Quality (Must Have)
1. Instant action (first 3 seconds)
2. Fair difficulty
3. Replayability
4. Multitap support
5. Performance on budget phones
6. Good contrast/readability

### Phase 3: Polish (Nice to Have)
1. Tutorial
2. Visual style
3. Game name visible
4. Preview image
5. Smooth animations

---

## Testing Strategy

### Automated Checks
- [ ] No backend calls detected
- [ ] No system dialogs in code
- [ ] No input fields
- [ ] No X-Frame-Options header
- [ ] No flashing >3/sec
- [ ] Touch event handlers present
- [ ] localStorage usage detected
- [ ] Demo Mode parameter check

### Manual Testing
- [ ] Open in iframe - no errors
- [ ] Tap controls - all work
- [ ] Portrait orientation - enforced
- [ ] Demo Mode - loops smoothly
- [ ] Game Over - clear feedback
- [ ] Sound - after first tap only
- [ ] Records - saved correctly
- [ ] Performance - smooth on budget phone

### User Testing
- [ ] First 3 seconds - something happens
- [ ] Game Over - user understands why
- [ ] Difficulty - fair and progressive
- [ ] Replayability - reason to play again
- [ ] Controls - responsive and intuitive
- [ ] Visual style - distinctive character

---

## Generator Requirements

The AI system must:

1. **Validate every requirement** - 35 checks before publishing
2. **Auto-fix common issues** - Missing Demo Mode, localStorage, etc.
3. **Test in sandbox** - Run game in hidden iframe, catch errors
4. **Provide feedback** - Show user what's missing
5. **Allow iteration** - User can request changes
6. **Ensure quality** - No games published without passing all checks

---

## Key Metrics

- **Minimum game size**: <100 KB (GitHub Pages friendly)
- **Load time**: <2 seconds (or show loading screen)
- **Demo loop**: 10-30 seconds
- **Tap response**: <100ms
- **Save/Load**: <50ms
- **Performance**: 60 FPS on budget Android

---

**Document Version**: 2.0
**Date**: May 2026
**Status**: Production Requirements
