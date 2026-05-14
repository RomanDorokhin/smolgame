import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
  const apiKey = process.env['GOOGLE_API_KEY'];
  if (!apiKey) {
    console.error('GOOGLE_API_KEY not found');
    return;
  }

  console.log('Initializing GoogleGenAI with httpOptions...');
  try {
    const ai = new GoogleGenAI({ 
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'TestAgent/1.0'
        }
      }
    });
    console.log('SDK Initialized. Calling generateContent...');
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-001',
      contents: [{ role: 'user', parts: [{ text: 'Hello' }] }]
    });

    console.log('Success:', JSON.stringify(response, null, 2));
  } catch (error: any) {
    console.error('FAILED.');
    console.error('Error:', error.message);
    if (error.stack) console.error('Stack:', error.stack);
  }
}

main().catch(console.error);
