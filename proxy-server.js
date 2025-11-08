const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const API_BASE = 'https://story-api.dicoding.dev/v1';

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Parse URL
  const parsedUrl = url.parse(req.url);
  const targetUrl = `${API_BASE}${parsedUrl.path}`;

  console.log(`[PROXY] ${req.method} ${targetUrl}`);

  // Proxy request
  const proxyReq = https.request(targetUrl, {
    method: req.method,
    headers: {
      ...req.headers,
      host: 'story-api.dicoding.dev',
    }
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[PROXY] Error:', err);
    res.writeHead(500);
    res.end(JSON.stringify({ error: true, message: err.message }));
  });

  req.pipe(proxyReq);
});

server.listen(PORT, () => {
  console.log(`\n🚀 Proxy server running on http://localhost:${PORT}`);
  console.log(`📡 Proxying to ${API_BASE}\n`);
});