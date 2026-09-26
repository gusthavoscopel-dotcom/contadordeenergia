// Servidor local que executa as funções de /api exatamente como a Vercel.
// Uso: npm run dev   (sobe este servidor na porta 3001 + o Vite na 5173)
// O Vite repassa /api/* para cá (ver vite.config.js).
import http from 'node:http';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.API_PORT || 3001);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const route = url.pathname.replace(/\/+$/, '');
  if (!route.startsWith('/api/') || route.includes('..') || route.split('/').some((p) => p.startsWith('_'))) {
    res.statusCode = 404;
    return res.end('Not found');
  }
  const file = resolve(root, `.${route}.js`);
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ ok: false, error: 'not_found' }));
  }
  try {
    const mod = await import(pathToFileURL(file).href);
    await mod.default(req, res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Erro interno');
    }
  }
  console.log(`${new Date().toLocaleTimeString('pt-BR')} ${req.method} ${route} → ${res.statusCode}`);
});

server.listen(PORT, () => console.log(`[api] rodando em http://localhost:${PORT}/api`));
