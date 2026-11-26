import { createServer } from 'node:http';
import { createServer as createSecureServer } from 'node:https';
import { mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, extname, isAbsolute, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { openDatabase } from './backend/db.mjs';
import { createApi } from './backend/api.mjs';
import { createCareRouter } from './backend/companion.mjs';
import { loadDatabaseKey } from './backend/storage.mjs';
import { hostAllowed, protectResponse, transportConfiguration } from './backend/security.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.gif': 'image/gif',
  '.woff2': 'font/woff2',
};

export function appServer({ database = ':memory:', databaseKey = null, careRouter = null, origin, tls, clock, logRequest } = {}) {
  if (Boolean(origin) !== Boolean(tls) || (tls && !databaseKey && database !== ':memory:')) {
    throw new Error('HTTPS requires a canonical origin and encrypted file storage.');
  }
  const db = openDatabase(database, databaseKey);
  const api = createApi(db, careRouter, { origin, clock });
  const requestHandler = async (request, response) => {
    let route = 'other';
    if (logRequest) {
      const started = performance.now();
      response.once('finish', () => logRequest({
        event:'http_request', route, status:response.statusCode,
        duration_ms:Number((performance.now() - started).toFixed(1)),
      }));
    }
    protectResponse(response, Boolean(tls));
    if (!hostAllowed(request.headers.host, origin)) {
      response.writeHead(400).end();
      return;
    }
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    } catch {
      response.writeHead(400).end();
      return;
    }
    if (pathname.startsWith('/api/')) {
      route = 'api';
      await api(request, response, pathname);
      return;
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    if (pathname === '/healthz') {
      route = 'health';
      let ready = true;
      try {
        db.prepare('SELECT name FROM sqlite_schema LIMIT 1').get();
      } catch {
        ready = false;
      }
      response.writeHead(ready ? 200 : 503, {
        'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store',
      });
      response.end(request.method === 'HEAD' ? undefined : JSON.stringify({ status:ready ? 'ok' : 'unavailable' }));
      return;
    }
    const assetRequest = pathname.startsWith('/assets/');
    const sourceRequest = pathname.startsWith('/src/');
    if (!assetRequest && !sourceRequest && pathname !== '/') {
      response.writeHead(404).end();
      return;
    }
    const allowed = resolve(root, assetRequest ? 'public/assets' : sourceRequest ? 'src' : '.');
    const file = resolve(root, pathname === '/' ? 'index.html' : assetRequest ? `public${pathname}` : `.${pathname}`);
    if (!file.startsWith(allowed + sep) || !types[extname(file)]) {
      response.writeHead(404).end();
      return;
    }
    route = assetRequest ? 'asset' : sourceRequest ? 'frontend' : 'page';
    try {
      const info = await stat(file);
      if (!info.isFile()) {
        response.writeHead(404).end();
        return;
      }
      const tag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
      const headers = {
        ETag:'W/' + tag,
        'Cache-Control':assetRequest ? 'public, max-age=300' : 'no-cache',
        'Content-Type':types[extname(file)],
      };
      const validators = request.headers['if-none-match']?.split(',') ?? [];
      if (validators.some(value => value.trim() === '*' || value.trim().replace(/^W\//, '') === tag)) {
        response.writeHead(304, headers).end();
        return;
      }
      if (request.method === 'HEAD') {
        response.writeHead(200, { ...headers, 'Content-Length':info.size }).end();
        return;
      }
      const body = await readFile(file);
      response.writeHead(200, { ...headers, 'Content-Length':body.length });
      response.end(body);
    } catch {
      response.writeHead(404).end();
    }
  };
  const limits = { headersTimeout:10_000, requestTimeout:20_000, maxHeaderSize:8192 };
  const server = tls ? createSecureServer({ ...limits, ...tls }, requestHandler) : createServer(limits, requestHandler);
  server.on('close', () => db.close());
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const production = process.env.NODE_ENV === 'production';
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  if (production && !isAbsolute(process.env.LUNARA_DB ?? '')) {
    throw new Error('Production requires an absolute LUNARA_DB path on persistent storage.');
  }
  const database = process.env.LUNARA_DB ? resolve(process.env.LUNARA_DB) : resolve(root, 'data/lunara.sqlite');
  const transport = await transportConfiguration();
  await mkdir(dirname(database), { recursive: true, mode: 0o700 });
  const databaseKey = loadDatabaseKey(database);
  const logging = process.env.LUNARA_REQUEST_LOG ?? (production ? '1' : '0');
  if (!['0','1'].includes(logging)) throw new Error('LUNARA_REQUEST_LOG must be 0 or 1.');
  const log = record => console.log(JSON.stringify({ time:new Date().toISOString(), ...record }));
  const server = appServer({
    database, databaseKey, careRouter:createCareRouter(), ...transport,
    logRequest:logging === '1' ? log : undefined,
  });
  server.listen(port, '127.0.0.1', () => {
    const address = transport.origin ?? 'http://127.0.0.1:' + port;
    if (production) log({ event:'server_started', https:true });
    else console.log(`LUNARA available at ${address}`);
  });
  const stop = () => server.close(() => {
    if (production) log({ event:'server_stopped' });
  });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
