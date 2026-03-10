// MyFin AI Proxy — Cloudflare Worker
// Deploy this to Cloudflare Workers (free tier: 100,000 requests/day)
//
// Setup Instructions:
// 1. Go to https://dash.cloudflare.com → Workers & Pages → Create Worker
// 2. Paste this code and click "Deploy"
// 3. Copy the worker URL (e.g., https://myfin-ai-proxy.your-name.workers.dev)
// 4. Update AICHAT_PROXY_URL in index.html with your worker URL
// 5. (Optional) Add a custom domain or rename the worker

const ALLOWED_ORIGINS = [
  'https://husainkachwala750.github.io',
  'http://localhost:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) || origin?.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }

    try {
      const body = await request.json();
      const { apiKey, ...requestBody } = body;

      if (!apiKey || !apiKey.startsWith('sk-ant-')) {
        return new Response(JSON.stringify({ error: 'Invalid or missing API key' }), {
          status: 401,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      // Forward to Anthropic API
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await anthropicResponse.json();

      if (!anthropicResponse.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || `Anthropic API error: ${anthropicResponse.status}` }), {
          status: anthropicResponse.status,
          headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 500,
        headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
      });
    }
  },
};
