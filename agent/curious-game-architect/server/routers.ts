import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import { invokeLLM } from "./_core/llm";
import { buildGamePrompt } from "@shared/interviewFlow";
import type { GameSpec } from "@shared/types";
import type { Message } from "./_core/llm";

/**
 * Retry an async function with exponential backoff
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000
): Promise<T> {
  let lastError: Error | unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Invoke LLM with a timeout
 */
async function invokeLLMWithTimeout(
  params: Parameters<typeof invokeLLM>[0],
  timeoutMs = 60000
): Promise<Awaited<ReturnType<typeof invokeLLM>>> {
  return Promise.race([
    invokeLLM(params),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("LLM request timed out")), timeoutMs)
    ),
  ]);
}

export const appRouter = router({
  // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  game: router({
    /**
     * AI chat procedure — generates a natural assistant response for the interview
     */
    chat: publicProcedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(["system", "user", "assistant"]),
              content: z.string(),
            })
          ),
        })
      )
      .mutation(async ({ input }) => {
        const messages = input.messages as Message[];

        try {
          const response = await withRetry(
            () =>
              invokeLLMWithTimeout(
                {
                  messages,
                },
                45000
              ),
            3,
            800
          );

          const content = response.choices[0]?.message?.content ?? "";
          return { success: true, content };
        } catch (error) {
          console.error("Chat LLM failed:", error);
          throw new Error("Failed to get AI response. Please try again.");
        }
      }),

    /**
     * Generate a game based on GameSpec using LLM
     */
    generateGame: publicProcedure
      .input(
        z.object({
          gameSpec: z.record(z.string(), z.string().optional()),
        })
      )
      .mutation(async ({ input }) => {
        const gameSpec = input.gameSpec as GameSpec;
        const prompt = buildGamePrompt(gameSpec);

        try {
          const response = await withRetry(
            () =>
              invokeLLMWithTimeout(
                {
                  messages: [
                    {
                      role: "system",
                      content:
                        "You are an expert game developer. Generate complete, production-ready HTML5 games that work in iframes and on mobile devices. Return ONLY the raw HTML code — no markdown, no code blocks, no explanations.",
                    },
                    {
                      role: "user",
                      content: prompt,
                    },
                  ],
                },
                120000
              ),
            2,
            2000
          );

          const rawHtml = response.choices[0]?.message?.content ?? "";
          let htmlCode = typeof rawHtml === 'string' ? rawHtml : '';

          // Strip markdown code blocks if the model wrapped the output
          htmlCode = htmlCode
            .replace(/^```html\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/\s*```$/i, "")
            .trim();

          // Post-process: ensure initGame() is called inside DOMContentLoaded if present
          // This fixes a common LLM mistake where initGame() is defined but never called
          if (
            htmlCode.includes('function initGame') &&
            htmlCode.includes('DOMContentLoaded') &&
            !htmlCode.match(/DOMContentLoaded[\s\S]{0,200}initGame\s*\(/)  
          ) {
            // Inject initGame() call into the DOMContentLoaded handler
            htmlCode = htmlCode.replace(
              /(document\.addEventListener\s*\(\s*['"]DOMContentLoaded['"]\s*,\s*(?:function\s*\(\)|\(\)\s*=>)\s*\{)/,
              '$1\n            initGame();'
            );
          }

          // Post-process: if there's an initGame but no DOMContentLoaded, add one before </script>
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

          return {
            success: true,
            htmlCode,
            prompt,
            gameSpec,
          };
        } catch (error) {
          console.error("Game generation failed:", error);
          throw new Error("Failed to generate game. Please try again.");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
