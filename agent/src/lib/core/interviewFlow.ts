import type { GameSpec } from './types';

export function buildGamePrompt(answers: GameSpec): string {
  return `Ты — Эксперт-разработчик SmolGame. Твоя задача: создать безупречную игру на основе спецификации.

СПЕЦИФИКАЦИЯ ИГРЫ:
- Жанр: ${answers.genre}
- Механика: ${answers.mechanics}
- Визуал: ${answers.visuals}
- Аудитория: ${answers.audience}
- Сюжет: ${answers.story}
- Прогрессия: ${answers.progression}
- Фишки: ${answers.special_features}

ЖЕСТКИЕ ТРЕБОВАНИЯ (MUST HAVE):
1. [UI] Один HTML-файл, все стили и скрипты внутри.
2. [UI] Вертикальная ориентация (Portrait), крупные кнопки (44px+).
3. [TOUCH] Только pointer/touch события. Никаких hover или клавиатуры.
4. [DEMO] На главном экране — авто-геймплей (демо-режим).
5. [SAVE] Рекорды сохраняются в localStorage.
6. [LANG] Весь текст СТРОГО на русском языке.
7. [API] Используй Telegram.WebApp.themeParams для цветов.

ОТВЕТЬ ТОЛЬКО БЛОКОМ КОДА <game_prototype>...</game_prototype>. Текст до или после кода запрещен.`;
}

export function buildGameIterationPrompt(answers: GameSpec, currentCode: string, feedback: string): string {
  return `Обнови игру на основе фидбека.

ТЕКУЩИЙ КОД:
${currentCode}

ОРИГИНАЛЬНАЯ СПЕЦ:
${JSON.stringify(answers)}

ФИДБЕК ПОЛЬЗОВАТЕЛЯ:
${feedback}

СОБЛЮДАЙ ВСЕ ТРЕБОВАНИЯ SMOLGAME (Touch, Portrait, Demo Mode, Russian Language).
ОТВЕТЬ ТОЛЬКО БЛОКОМ КОДА <game_prototype>...</game_prototype>.`;
}
