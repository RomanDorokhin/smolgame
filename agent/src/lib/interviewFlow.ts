import type { GameSpec } from './gameRequirementValidatorPro';

export function buildGamePrompt(answers: GameSpec): string {
  return `Create a ${answers.genre} game with the following mechanics: ${answers.mechanics}. 
  Visual style: ${answers.visuals}. 
  Target audience: ${answers.audience}. 
  Story: ${answers.story}. 
  Progression: ${answers.progression}. 
  Special features: ${answers.special_features}.`;
}

export function buildGameIterationPrompt(answers: GameSpec, currentCode: string, feedback: string): string {
  return `Current game code: ${currentCode.slice(0, 100)}...
  Original spec: ${JSON.stringify(answers)}
  User feedback: ${feedback}
  Please update the game based on this feedback.`;
}
