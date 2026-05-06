
import fs from 'fs';

const filePath = '/Users/romandorohin/kiniga/smolgame/agent/src/hooks/useChat.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Fix common mistakes in the feedback prompt
content = content.replace(/const feedbackPrompt = `К сожалению, игра не прошла проверку качества \(Оценка: \${result\.score}\/100\)\.[\s\S]*?с исправлениями\.`;/, 
`const feedbackPrompt = "К сожалению, игра не прошла проверку качества (Оценка: " + result.finalScore + "/100). " +
"Пожалуйста, проанализируй эти ошибки внутри <thought>, объясни пользователю, что пошло не так, и предложи исправить код. Если ты готов исправить прямо сейчас — сгенерируй новый <game_prototype> с исправлениями.";`);

// Fix the deploy error message
content = content.replace(/sendMessage\(`Ошибка при деплое: \${e instanceof Error \? e\.message : String\(e\)}`, true\);/, 
`sendMessage("Ошибка при деплое: " + (e instanceof Error ? e.message : String(e)), true);`);

fs.writeFileSync(filePath, content);
console.log('File patched successfully');
