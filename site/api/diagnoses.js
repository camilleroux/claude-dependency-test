// POST   /api/diagnoses          -> publish a report, returns { slug, url, token }
// PUT    /api/diagnoses/:slug    -> replace it (Authorization: Bearer <token>)
// DELETE /api/diagnoses/:slug    -> delete it  (Authorization: Bearer <token>)
//
// Only the output of sanitizeReport() is stored: numbers and enum values. The delete token is
// returned once and stored hashed. No IP address or user agent is stored (the rate limiter keys
// on a salted hash of the IP that expires after an hour).
import { sanitizeReport } from '../public/card.js';
import { SLUG_RE, TTL_SECONDS, getStore, reportKey } from '../lib/store.js';
import { forgetScore, rankFor, recordScore, safely } from '../lib/rank.js';

export const config = { runtime: 'edge' };

const MAX_BODY_BYTES = 16_000;
const WRITES_PER_HOUR = 30;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const json = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

function randomString(length) {
  const bytes = crypto.getRandomValues(new Uint8Array(length * 2));
  let out = '';
  for (const b of bytes) {
    if (b < 248) out += ALPHABET[b % 62]; // 248 = 4 × 62, keeps the distribution uniform
    if (out.length === length) return out;
  }
  return out + randomString(length - out.length);
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function readReport(request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) return { status: 413, error: 'payload too large' };
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    return { status: 400, error: 'invalid JSON' };
  }
  const { report, error } = sanitizeReport(body);
  return report ? { report } : { status: 400, error };
}

// Secret salt so the rate-limit key can't be reversed into an IP address by brute force.
// Set CDT_IP_SALT in production (shared by all instances). Without it, each instance draws a
// random salt at startup: still irreversible, but limits are then counted per instance.
let instanceSalt = null; // drawn on first use: some edge runtimes forbid randomness at module load
const ipSalt = () => (typeof process !== 'undefined' && process.env.CDT_IP_SALT) || (instanceSalt ??= randomString(32));

async function rateLimited(store, request) {
  const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  const key = `cdt:rl:${(await sha256(`${ipSalt()}:${ip}`)).slice(0, 24)}`;
  return (await store.incr(key, 3600)) > WRITES_PER_HOUR;
}

async function authorize(store, request, slug) {
  const entry = await store.get(reportKey(slug));
  if (!entry) return { status: 404 };
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || (await sha256(token)) !== entry.tokenHash) return { status: 403 };
  return { entry };
}

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || url.pathname.split('/api/diagnoses/')[1] || '';
  const store = getStore();
  if (!store) return json(503, { error: 'storage is not configured on this share site' });

  if (request.method === 'POST' && !slug) {
    if (await rateLimited(store, request)) return json(429, { error: 'too many publications from this network, try again in an hour' });
    const { report, status, error } = await readReport(request);
    if (!report) return json(status, { error });
    let newSlug;
    do newSlug = randomString(10);
    while (await store.get(reportKey(newSlug)));
    const token = randomString(32);
    const now = new Date().toISOString();
    await store.set(reportKey(newSlug), { report, tokenHash: await sha256(token), createdAt: now, updatedAt: now }, TTL_SECONDS);
    await safely(() => recordScore(store, newSlug, report.score));
    const rank = await safely(() => rankFor(store, report.score));
    return json(201, { slug: newSlug, url: `${url.origin}/case/${newSlug}`, token, rank });
  }

  if ((request.method === 'PUT' || request.method === 'DELETE') && SLUG_RE.test(slug)) {
    if (await rateLimited(store, request)) return json(429, { error: 'too many requests, try again in an hour' });
    const { entry, status } = await authorize(store, request, slug);
    if (!entry) return json(status, { error: status === 404 ? 'not found' : 'wrong token' });
    if (request.method === 'DELETE') {
      await store.del(reportKey(slug));
      await safely(() => forgetScore(store, slug));
      return json(204, null);
    }
    const { report, status: bad, error } = await readReport(request);
    if (!report) return json(bad, { error });
    await store.set(reportKey(slug), { ...entry, report, updatedAt: new Date().toISOString() }, TTL_SECONDS);
    await safely(() => recordScore(store, slug, report.score));
    const rank = await safely(() => rankFor(store, report.score));
    return json(200, { slug, url: `${url.origin}/case/${slug}`, rank });
  }

  return json(405, { error: 'method not allowed' });
}
