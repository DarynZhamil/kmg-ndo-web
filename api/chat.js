// Vercel serverless function: /api/chat
// Proxies requests to Anthropic API (avoids CORS in browser)
// Requires environment variable: ANTHROPIC_API_KEY

const https = require('https');

module.exports = async (req, res) => {
  // CORS headers — allow from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Forward request to Anthropic using model claude-3-haiku
    const payload = JSON.stringify({
      model: body.model || 'claude-3-haiku-20240307',
      max_tokens: body.max_tokens || 1024,
      system: body.system || '',
      messages: body.messages || [],
    });

    const response = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(payload),
        },
      };

      const proxyReq = https.request(options, (proxyRes) => {
        let data = '';
        proxyRes.on('data', (chunk) => { data += chunk; });
        proxyRes.on('end', () => resolve({ status: proxyRes.statusCode, body: data }));
      });

      proxyReq.on('error', reject);
      proxyReq.write(payload);
      proxyReq.end();
    });

    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    return res.end(response.body);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
