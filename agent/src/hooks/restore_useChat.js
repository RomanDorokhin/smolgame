
import fs from 'fs';

const filePath = '/Users/romandorohin/kiniga/smolgame/agent/src/hooks/useChat.ts';

// Complete replacement of the problematic part to ensure NO backtick issues
const content = fs.readFileSync(filePath, 'utf8');

// Use a very safe way to replace the start of the file
const startOfFile = `import { useState, useRef, useEffect, useCallback } from "react";
import { 
  ChatSession, 
  ChatMessage, 
  ChatSettings, 
  UsageStats, 
  ModelProgress, 
  APIProvider 
} from "../types/chat";
import { runGamePipeline } from "../lib/core/gameGenerationPipelinePro";
import { GameFlowOrchestratorV2 } from "../lib/core/gameFlowOrchestratorV2";

const SESSIONS_KEY = "smol_chat_sessions_v2";
const ACTIVE_SESSION_KEY = "smol_active_session_id_v2";
const SETTINGS_KEY = "smol_chat_settings_v2";
const USAGE_KEY = "smol_chat_usage_v2";

const SYSTEM_PROMPT_CONTENT = "Ты — Старший Геймдизайнер и Архитектор SmolGame. Твоя задача: помочь пользователю создать идеальную игру через интервью.\\n\\n" +
"1. МЫШЛЕНИЕ: Анализируй в <thought>.\\n" +
"2. ЗАПРЕТ НА КОД: СТРОГО ЗАПРЕЩЕНО писать код в чате (блоки \`\`\`). Весь код — ТОЛЬКО в <game_prototype>.\\n" +
"3. ИНТЕРВЬЮ: Заполняй 7 полей (Жанр, Механика и т.д.).\\n" +
"4. ГЕНЕРАЦИЯ: Когда готов — выдавай <game_prototype>.\\n" +
"5. ЯЗЫК: Русский.";

function generateId() {
  return Math.random().toString(36).substring(2, 15);
}
`;

// Find where the imports end and the hook starts
const hookStart = content.indexOf('export function useChat()');
if (hookStart !== -1) {
    const finalContent = startOfFile + "\n" + content.substring(hookStart);
    fs.writeFileSync(filePath, finalContent);
    console.log('File restored successfully');
} else {
    console.error('Could not find hook start');
}
