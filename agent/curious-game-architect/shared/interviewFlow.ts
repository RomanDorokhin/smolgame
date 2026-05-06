import { GameSpec, InterviewQuestion } from './types';

/**
 * Interview questions that guide the user through game design
 */
export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 'genre',
    field: 'genre',
    question: 'What genre is your game? (e.g., puzzle, action, adventure, strategy, casual, racing, etc.)',
  },
  {
    id: 'mechanics',
    field: 'mechanics',
    question: 'Describe the main game mechanics. What does the player do? (e.g., tap to jump, swipe to move, click to shoot, etc.)',
  },
  {
    id: 'visuals',
    field: 'visuals',
    question: 'What visual style do you want? (e.g., pixel art, minimalist, colorful, dark, retro, 3D-like, etc.)',
  },
  {
    id: 'audience',
    field: 'audience',
    question: 'Who is the target audience? (e.g., kids, casual players, hardcore gamers, all ages, etc.)',
  },
  {
    id: 'story',
    field: 'story',
    question: 'Is there a story or theme? (e.g., save the princess, escape the maze, collect coins, survive waves, etc.)',
  },
  {
    id: 'progression',
    field: 'progression',
    question: 'How does difficulty progress? (e.g., increasing speed, more enemies, harder patterns, time limits, etc.)',
  },
  {
    id: 'special_features',
    field: 'special_features',
    question: 'Any special features? (e.g., power-ups, combos, leaderboards, sound effects, particle effects, etc.)',
  },
];

/**
 * Check which GameSpec fields are filled
 */
export function getFilledFields(gameSpec: GameSpec): (keyof GameSpec)[] {
  return Object.keys(gameSpec).filter(
    (key) => gameSpec[key as keyof GameSpec] && gameSpec[key as keyof GameSpec]?.trim()
  ) as (keyof GameSpec)[];
}

/**
 * Get progress percentage
 */
export function getProgressPercentage(gameSpec: GameSpec): number {
  const filled = getFilledFields(gameSpec).length;
  const total = INTERVIEW_QUESTIONS.length;
  return Math.round((filled / total) * 100);
}

/**
 * Check if all required fields are filled
 */
export function isGameSpecComplete(gameSpec: GameSpec): boolean {
  return getFilledFields(gameSpec).length === INTERVIEW_QUESTIONS.length;
}

/**
 * Get the next unanswered question
 */
export function getNextQuestion(gameSpec: GameSpec): InterviewQuestion | null {
  const filledFields = getFilledFields(gameSpec);
  const nextQuestion = INTERVIEW_QUESTIONS.find(
    (q) => !filledFields.includes(q.field)
  );
  return nextQuestion || null;
}

/**
 * Build the final prompt for game generation with all technical requirements.
 * Optimized to be concise while preserving all mandatory constraints.
 */
export function buildGamePrompt(gameSpec: GameSpec): string {
  const spec = `Genre: ${gameSpec.genre || 'Not specified'}
Mechanics: ${gameSpec.mechanics || 'Not specified'}
Visual Style: ${gameSpec.visuals || 'Not specified'}
Target Audience: ${gameSpec.audience || 'Not specified'}
Story/Theme: ${gameSpec.story || 'Not specified'}
Progression: ${gameSpec.progression || 'Not specified'}
Special Features: ${gameSpec.special_features || 'Not specified'}`;

  return `Create a complete, production-ready HTML5 game as a SINGLE self-contained HTML file.

GAME DESIGN:
${spec}

MANDATORY TECHNICAL REQUIREMENTS:
• Works without backend — only static HTML/CSS/JS
• Runs in iframe sandbox (allow-scripts allow-same-origin)
• Touch controls required (min 44x44px tap targets); no mouse-only
• Portrait orientation (vertical screen)
• No alert/confirm/prompt dialogs; no native keyboard inside game
• Auto-start: call initGame() inside DOMContentLoaded — game must start automatically without user interaction
• Demo Mode: real looped gameplay starts automatically (no sound in demo)
• Loading screen if startup > 2 seconds
• Game Over screen with score + "Play Again" button
• Pause button (auto-pause on page hide)
• First 3 seconds: immediate action — something happens right away
• Balanced difficulty — not trivial, not impossible
• Progressive difficulty — each level/wave harder than the last
• Clear Game Over reason shown to player
• Built-in tutorial for non-obvious mechanics
• High scores + progress saved via localStorage (warn user it's device-bound)
• Sound only after first user tap/click
• Performance on budget Android phones (no heavy WebGL, no large assets)
• Game title visible inside the game
• Minimum 16px font; high contrast for sunlight readability
• No 18+ content, violence, or politics
• No flashing faster than 3 times/second (epilepsy protection)
• Multi-touch support
• Replayable: randomization, records, or different paths
• Russian language OR visual-only (no mixed languages)
• Cache-busting: add ?v=1 or timestamp to any asset URLs

OUTPUT: Return ONLY the raw HTML. No markdown, no code fences, no explanations.`;
}
