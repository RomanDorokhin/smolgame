
import fs from 'fs';

const filePath = '/Users/romandorohin/kiniga/smolgame/agent/src/hooks/useChat.ts';
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

// Line numbers are 1-based, array is 0-based
// Fix feedbackPrompt
lines[402] = '              const feedbackPrompt = "К сожалению, игра не прошла проверку качества (Оценка: " + result.finalScore + "/100). " +';
lines[403] = '                "Ошибки:\\n" + errorSummary + "\\n\\n" +';
lines[404] = '                "Пожалуйста, проанализируй эти ошибки внутри <thought>, объясни пользователю, что пошло не так, и предложи исправить код. Если ты готов исправить прямо сейчас — сгенерируй новый <game_prototype> с исправлениями.";';
// Clear lines 405, 406, 407 if they were part of the old multi-line backtick string
// Actually, let's just find the start and end of that mess.

fs.writeFileSync(filePath, lines.join('\n'));
console.log('File patched successfully');
