const http = require('http');
const https = require('https');

const MISTRAL_KEY = 'SWTtIPXZG5CUGtpYt6TVaIaTT4KykwmJ';
const idMap = new Map();

function getMistralId(openaiId) {
  if (!idMap.has(openaiId)) {
    idMap.set(openaiId, Math.random().toString(36).substring(2, 11));
  }
  return idMap.get(openaiId);
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      let data = JSON.parse(body);

      // STRIP PROBLEMATIC FIELDS
      delete data.logit_bias;
      delete data.reasoning_effort; // FIXED: Mistral doesn't support this!
      delete data.max_completion_tokens; // Mistral wants max_tokens

      if (data.messages) {
        data.messages.forEach(m => {
          if (m.tool_calls) {
            m.tool_calls.forEach(tc => tc.id = getMistralId(tc.id));
          }
          if (m.tool_call_id) {
            m.tool_call_id = getMistralId(m.tool_call_id);
          }
        });
      }

      const options = {
        hostname: 'api.mistral.ai',
        path: '/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${MISTRAL_KEY}`
        }
      };

      const proxyReq = https.request(options, proxyRes => {
        proxyRes.pipe(res);
      });

      proxyReq.write(JSON.stringify(data));
      proxyReq.end();
    });
  }
});

server.listen(3000, () => {
  console.log('Mistral Proxy (v3) listening on port 3000');
});
