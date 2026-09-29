// Local preview without the Vercel CLI: serves public/, applies the rewrites from vercel.json and
// runs the edge handlers in Node. Without KV_REST_API_URL/TOKEN, published reports live in memory.
// Usage: npm run dev  (then open http://localhost:8787)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { memoryStore } from '../lib/store.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8787);
const { rewrites } = JSON.parse(fs.readFileSync(path.join(SITE, 'vercel.json'), 'utf8'));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL) {
  globalThis.__cdtStore = memoryStore();
  console.log('No KV credentials: using an in-memory store (data is lost on restart).');
}

/** Applies the first matching `/a/:param` style rewrite. Returns the destination URL or null. */
export function rewrite(url) {
  for (const { source, destination } of rewrites) {
    const names = [];
    const re = new RegExp(`^${source.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; })}$`);
    const m = url.pathname.match(re);
    if (!m) continue;
    let dest = destination;
    names.forEach((n, i) => { dest = dest.replace(`:${n}`, encodeURIComponent(m[i + 1])); });
    const out = new URL(dest, url.origin);
    for (const [k, v] of url.searchParams) if (!out.searchParams.has(k)) out.searchParams.append(k, v);
    return out;
  }
  return null;
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    const target = rewrite(url) || (url.pathname.startsWith('/api/') ? url : null);
    if (target) {
      const file = path.join(SITE, `${target.pathname}.js`);
      if (!fs.existsSync(file)) return void res.writeHead(404).end('Not found');
      // Re-import when the file changes, so edits show up without restarting the dev server.
      const { default: handler } = await import(`${pathToFileURL(file).href}?v=${fs.statSync(file).mtimeMs}`);
      const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
      const request = new Request(new URL(`${target.pathname}${target.search}`, url.origin), {
        method: req.method,
        headers: { ...req.headers, 'x-forwarded-for': req.socket.remoteAddress || '' },
        body,
      });
      const response = await handler(request);
      const out = Buffer.from(await response.arrayBuffer());
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return void res.end(out);
    }
    const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    let file = path.join(SITE, 'public', path.normalize(rel));
    if (!path.extname(file) && fs.existsSync(`${file}.html`)) file = `${file}.html`; // like cleanUrls on Vercel
    else if (fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html'); // directory index
    if (!file.startsWith(path.join(SITE, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return void res.writeHead(404).end('Not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) res.writeHead(500);
    res.end('Internal error');
  }
}).listen(PORT, () => console.log(`Claude Dependency Test site on http://localhost:${PORT}`));
