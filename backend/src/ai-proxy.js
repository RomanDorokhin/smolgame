import { error } from './http.js';
import { authenticate } from './auth.js';

/**
 * AI Proxy Handler
 * Securely calls LLM providers using server-side keys.
 * Supports streaming via Server-Sent Events (SSE).
 */
export async function handleAiChat(req, env) {
  // 1. Authenticate user (optional but recommended to prevent public abuse)
  const user = await authenticate(req, env);
  if (!user) return error('Unauthorized', 401);

  // 2. Parse request
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return error('Invalid JSON', 400);
  }

  const { provider, model, messages, stream = true } = body;

  if (!messages || !Array.isArray(messages)) {
    return error('Messages array is required', 400);
  }

  // 3. Select Provider
  if (provider === 'openai') {
    return handleOpenAI(messages, model || 'gpt-4o', stream, env);
  } else if (provider === 'anthropic') {
    return handleAnthropic(messages, model || 'claude-3-5-sonnet-20240620', stream, env);
  } else if (provider === 'google') {
    return handleGoogle(messages, model || 'gemini-1.5-pro', stream, env);
  }

  return error(`Unsupported provider: ${provider}`, 400);
}

async function handleOpenAI(messages, model, stream, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) return error('OpenAI API Key not configured on server', 503);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream,
    }),
  });

  return forwardResponse(response, stream);
}

async function handleAnthropic(messages, model, stream, env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) return error('Anthropic API Key not configured on server', 503);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: messages.filter(m => m.role !== 'system'),
      system: messages.find(m => m.role === 'system')?.content,
      max_tokens: 4096,
      stream,
    }),
  });

  return forwardResponse(response, stream);
}

async function handleGoogle(messages, model, stream, env) {
  const apiKey = env.GOOGLE_API_KEY;
  if (!apiKey) return error('Google API Key not configured on server', 503);

  // Gemini has a different API structure
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents }),
  });

  return forwardResponse(response, stream);
}

function forwardResponse(response, stream) {
  if (!response.ok) {
    return error(`AI provider error: ${response.status} ${response.statusText}`, 502);
  }

  if (!stream) {
    return response;
  }

  // Forward the stream
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
