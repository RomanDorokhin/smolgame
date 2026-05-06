import { useState, useCallback, useRef } from 'react';
import {
  INTERVIEW_QUESTIONS,
  getNextQuestion,
  isGameSpecComplete,
  getProgressPercentage,
  buildGamePrompt,
} from '@shared/interviewFlow';
import type { GameSpec, ChatMessage } from '@shared/types';
import { callLLM, getLLMSettings } from '@/lib/llm-client';

interface UseGameInterviewReturn {
  gameSpec: GameSpec;
  messages: ChatMessage[];
  /** True while the AI is generating a chat reply */
  isLoading: boolean;
  /** True while the game HTML is being generated */
  isGenerating: boolean;
  progress: number;
  isComplete: boolean;
  sendMessage: (content: string) => Promise<void>;
  generateGame: () => Promise<{ htmlCode: string; prompt: string }>;
  resetInterview: () => void;
}

const SYSTEM_PROMPT = `Ты — дружелюбный и вдохновляющий геймдизайнер по имени "Game Architect". Твоя задача — помочь пользователю спроектировать игру его мечты через живое, естественное общение.

ПРАВИЛА ОБЩЕНИЯ:
1. КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО показывать пользователю технические списки, ТЗ или статус заполнения полей (например: "✓ Genre"). Это только для твоего внутреннего пользования.
2. Говори как человек с человеком. Никакого сухого технического описания. Не повторяй всё ТЗ пользователю.
3. Задавай строго ОДИН вопрос за раз.
4. Будь кратким (2-3 предложения). Сначала кратко (одной фразой) похвали идею пользователя, затем задай следующий вопрос.
5. Не используй технический жаргон, если пользователь сам его не ввел.
6. Когда все темы будут обсуждены, просто скажи, что у тебя теперь достаточно информации и ты готов приступать к созданию игры.

Темы для обсуждения (иди по порядку):
1. Жанр (пазл, экшен, приключения и т.д.)
2. Механика (что делает игрок: прыгает, стреляет, свайпает)
3. Визуальный стиль (пиксель-арт, минимализм, ретро)
4. Аудитория (дети, казуалы, хардкорщики)
5. Сюжет или тема (спасение принцессы, выживание, сбор монет)
6. Прогрессия сложности (ускорение, больше врагов)
7. Фишки (пауэр-апы, комбо, эффекты)`;

function buildSystemMessage(gameSpec: GameSpec): string {
  const collected = Object.entries(gameSpec)
    .filter(([, v]) => v)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n');

  const status = INTERVIEW_QUESTIONS.map((q) => {
    const filled = !!gameSpec[q.field];
    return `${filled ? '✓' : '○'} ${q.field}${filled ? `: ${gameSpec[q.field]}` : ''}`;
  }).join('\n');

  return `${SYSTEM_PROMPT}

ВАЖНО: Ниже приведен статус собранного ТЗ. ЭТО ДЛЯ ТЕБЯ. НЕ ПОКАЗЫВАЙ ЭТО ПОЛЬЗОВАТЕЛЮ.
Собранные данные:
${collected || '(пока ничего нет)'}

Статус готовности:
${status}`;
}

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    role,
    content,
    timestamp: new Date(),
  };
}

export function useGameInterview(): UseGameInterviewReturn {
  const [gameSpec, setGameSpec] = useState<GameSpec>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Keep a ref to the latest gameSpec for use inside callbacks without stale closure
  const gameSpecRef = useRef<GameSpec>({});
  gameSpecRef.current = gameSpec;

  // Replaced trpc mutations with direct LLM calls

  const progress = getProgressPercentage(gameSpec);
  const isComplete = isGameSpecComplete(gameSpec);

  const resetInterview = useCallback(() => {
    setGameSpec({});
    setMessages([]);
    setIsLoading(false);
    setIsGenerating(false);
  }, []);

  const sendMessage = useCallback(
    async (userContent: string) => {
      // Allow empty string only for the initial greeting trigger
      if (!userContent.trim() && messages.length > 0) return;

      const isInitialGreeting = !userContent.trim() && messages.length === 0;

      // Add user message to the chat (skip for initial greeting)
      let updatedMessages = [...messages];
      if (!isInitialGreeting) {
        const userMsg = makeMessage('user', userContent);
        updatedMessages = [...updatedMessages, userMsg];
        setMessages(updatedMessages);
      }

      setIsLoading(true);

      try {
        // Update GameSpec with the user's answer to the current question
        let updatedSpec = { ...gameSpecRef.current };
        if (!isInitialGreeting) {
          const nextQuestion = getNextQuestion(updatedSpec);
          if (nextQuestion) {
            updatedSpec = { ...updatedSpec, [nextQuestion.field]: userContent };
            setGameSpec(updatedSpec);
          }
        }

        // Build the messages array for the LLM
        const llmMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
          { role: 'system', content: buildSystemMessage(updatedSpec) },
          // Include conversation history
          ...updatedMessages
            .map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content,
            })),
        ];

        // Call the LLM for a natural response
        const settings = getLLMSettings();
        const aiContent = await callLLM(llmMessages, settings);

        const aiMsg = makeMessage('assistant', aiContent);
        setMessages((prev) => [...prev, aiMsg]);
      } catch (error) {
        console.error('Error in interview chat:', error);

        // Graceful fallback: use hardcoded question if LLM fails
        const updatedSpec = gameSpecRef.current;
        let fallbackContent: string;

        if (messages.length === 0) {
          fallbackContent =
            "Привет! Я твой геймдизайнер 🎮 Давай спроектируем крутую игру вместе!\n\n**В каком жанре будет твоя игра?** (например: пазл, экшен, приключения, стратегия)";
        } else if (isGameSpecComplete(updatedSpec)) {
          fallbackContent =
            '🎮 Отлично! У меня есть все детали. Начинаю создавать твою игру... Это может занять минуту! ⏳';
        } else {
          const nextQ = getNextQuestion(updatedSpec);
          fallbackContent = nextQ
            ? `Понял! 👍\n\n**${nextQ.question}**`
            : "Думаю, у меня достаточно информации. Давай создавать игру!";
        }

        const fallbackMsg = makeMessage('assistant', fallbackContent);
        setMessages((prev) => [...prev, fallbackMsg]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages]
  );

  const generateGame = useCallback(async () => {
    setIsGenerating(true);
    try {
      const settings = getLLMSettings();
      const prompt = buildGamePrompt(gameSpecRef.current as GameSpec);
      
      const rawHtml = await callLLM([
        {
          role: "system",
          content: "You are an expert game developer. Generate complete, production-ready HTML5 games that work in iframes and on mobile devices. Return ONLY the raw HTML code — no markdown, no code blocks, no explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ], settings);

      let htmlCode = typeof rawHtml === 'string' ? rawHtml : '';

      // Strip markdown code blocks if the model wrapped the output
      htmlCode = htmlCode
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      // Post-process logic (same as original server logic)
      if (
        htmlCode.includes('function initGame') &&
        htmlCode.includes('DOMContentLoaded') &&
        !htmlCode.match(/DOMContentLoaded[\s\S]{0,200}initGame\s*\(/)  
      ) {
        htmlCode = htmlCode.replace(
          /(document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{)/,
          '$1\n            initGame();'
        );
      }
      
      if (
        htmlCode.includes('function initGame') &&
        !htmlCode.includes('DOMContentLoaded') &&
        !htmlCode.match(/initGame\s*\(\s*\)\s*;/)
      ) {
        htmlCode = htmlCode.replace(
          /(<\/script>)/,
          '\n        document.addEventListener(\'DOMContentLoaded\', initGame);\n        $1'
        );
      }

      const successMsg = makeMessage(
        'assistant',
        '🎮 **Your game is ready!** Check the preview on the right. You can play it directly or download it as a standalone HTML file. Click **"Start Over"** to design a new game!'
      );
      setMessages((prev) => [...prev, successMsg]);

      return {
        htmlCode,
        prompt,
      };
    } catch (error) {
      console.error('Game generation error:', error);
      const errorMsg = makeMessage(
        'assistant',
        '❌ Failed to generate the game. Please try again by clicking the **"Generate Game"** button, or start over with a new design.'
      );
      setMessages((prev) => [...prev, errorMsg]);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    gameSpec,
    messages,
    isLoading,
    isGenerating,
    progress,
    isComplete,
    sendMessage,
    generateGame,
    resetInterview,
  };
}
