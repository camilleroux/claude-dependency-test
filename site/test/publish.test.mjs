import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import api from '../api/diagnoses.js';
import page from '../api/d.js';
import badge from '../api/badge.js';
import { memoryStore } from '../lib/store.js';
import { DEMO_REPORT } from '../lib/demo.js';
import { sanitizeReport } from '../public/card.js';
import { run } from '../../plugins/claude-dependency-test/scripts/diagnose.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, '..', '..', 'plugins', 'claude-dependency-test', 'test', 'fixtures', 'basic');
const ORIGIN = 'https://cdt.test';
const fetchToSite = async (url, init = {}) => api(new Request(url, init));
const post = (body, headers = {}) => api(new Request(`${ORIGIN}/api/diagnoses`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));

beforeEach(() => { globalThis.__cdtStore = memoryStore(); });

test('sanitizeReport accepts the demo, drops unknown keys and rejects free text', () => {
  assert.ok(sanitizeReport(DEMO_REPORT).report);
  const extra = sanitizeReport({ ...DEMO_REPORT, projectName: 'secret', extras: { ...DEMO_REPORT.extras, note: 'hi' } }).report;
  assert.ok(!('projectName' in extra) && !('note' in extra.extras));
  const bad = [
    { ...DEMO_REPORT, archetype: '<script>' },
    { ...DEMO_REPORT, score: 101 },
    { ...DEMO_REPORT, score: 74 }, // disagrees with the card
    { ...DEMO_REPORT, modelMix: { 'my-private-model': 1 } },
    { ...DEMO_REPORT, window: { ...DEMO_REPORT.window, startDay: 'yesterday' } },
    { ...DEMO_REPORT, daily: DEMO_REPORT.daily.slice(1) },
    { ...DEMO_REPORT, criteria: [{ key: 'hours', points: 25, earned: 10, parts: [{ metric: 'rm -rf', value: 1, from: 0, to: 1 }] }] },
  ];
  for (const b of bad) assert.ok(sanitizeReport(b).error, JSON.stringify(b).slice(0, 60));
});

test('API: publish, read, update with token, reject wrong token, delete', async () => {
  const created = await post(DEMO_REPORT);
  assert.equal(created.status, 201);
  const { slug, url, token } = await created.json();
  assert.match(slug, /^[A-Za-z0-9]{10}$/);
  assert.equal(url, `${ORIGIN}/case/${slug}`);
  assert.ok(token.length >= 32);
  const stored = await globalThis.__cdtStore.get(`cdt:report:${slug}`);
  assert.ok(!JSON.stringify(stored).includes(token), 'token must be stored hashed');

  const html = await (await page(new Request(`${ORIGIN}/api/d?slug=${slug}`))).text();
  assert.match(html, /<meta property="og:image" content="https:\/\/cdt\.test\/og\/[A-Za-z0-9]{10}">/);
  assert.match(html, /Stage 4 \(Chronic\)/);

  const put = (auth, body = { ...DEMO_REPORT, score: 55, stage: 3, card: { ...DEMO_REPORT.card, score: 55, stage: 3 } }) =>
    api(new Request(`${ORIGIN}/api/diagnoses?slug=${slug}`, { method: 'PUT', headers: { authorization: auth }, body: JSON.stringify(body) }));
  assert.equal((await put('Bearer nope')).status, 403);
  assert.equal((await put(`Bearer ${token}`)).status, 200);
  assert.match(await (await badge(new Request(`${ORIGIN}/api/badge?slug=${slug}`))).text(), /stage 3 · 55\/100/);

  const del = (auth) => api(new Request(`${ORIGIN}/api/diagnoses?slug=${slug}`, { method: 'DELETE', headers: { authorization: auth } }));
  assert.equal((await del('Bearer nope')).status, 403);
  assert.equal((await del(`Bearer ${token}`)).status, 204);
  assert.equal((await page(new Request(`${ORIGIN}/api/d?slug=${slug}`))).status, 404);
});

test('API: rejects bad input, oversized bodies and floods', async () => {
  assert.equal((await post('{nope')).status, 400);
  assert.equal((await post({ ...DEMO_REPORT, archetype: 'hacker' })).status, 400);
  assert.equal((await post('x'.repeat(20_000))).status, 413);
  assert.equal((await api(new Request(`${ORIGIN}/api/diagnoses`, { method: 'GET' }))).status, 405);
  let last;
  for (let i = 0; i < 31; i++) last = await post(DEMO_REPORT, { 'x-forwarded-for': '203.0.113.9' });
  assert.equal(last.status, 429);
  assert.equal((await post(DEMO_REPORT, { 'x-forwarded-for': '203.0.113.10' })).status, 201);
});

test('API: 503 when no storage is configured', async () => {
  delete globalThis.__cdtStore;
  assert.equal((await post(DEMO_REPORT)).status, 503);
});

test('plugin → site: publishes real results, re-runs update the same link, unpublish deletes it', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cdt-pub-'));
  const argv = ['--json', '--tz', 'UTC', '--now', '2026-09-28T12:00:00Z', '--out', out];
  const env = { CLAUDE_CONFIG_DIR: FIXTURES, CDT_SHARE_BASE_URL: ORIGIN };

  const first = (await run(argv, env, { fetchImpl: fetchToSite })).result;
  assert.equal(first.published.updated, false);
  assert.equal(first.share.url, first.published.url);
  assert.equal(first.share.badge, `${ORIGIN}/badge/${first.published.slug}`);
  const state = JSON.parse(fs.readFileSync(path.join(out, 'published.json'), 'utf8'));
  assert.equal((fs.statSync(path.join(out, 'published.json')).mode & 0o777).toString(8), '600');

  // What reached the server holds no transcript data at all.
  const stored = await globalThis.__cdtStore.get(`cdt:report:${state.slug}`);
  assert.ok(!/SECRET|alice|toolu_|msg_|req_/.test(JSON.stringify(stored)));
  assert.equal(stored.report.sample.prompts, 5);

  const second = (await run(argv, env, { fetchImpl: fetchToSite })).result;
  assert.equal(second.published.slug, first.published.slug);
  assert.equal(second.published.updated, true);

  const gone = (await run(['--unpublish', '--out', out], env, { fetchImpl: fetchToSite })).result;
  assert.equal(gone.unpublished.deleted, true);
  assert.equal(await globalThis.__cdtStore.get(`cdt:report:${state.slug}`), null);
  assert.ok(!fs.existsSync(path.join(out, 'published.json')));
});

test('plugin: an unreachable share site falls back to the stateless link', async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cdt-pub-'));
  const offline = async () => { throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } }); };
  const { result, text } = await run(['--json', '--tz', 'UTC', '--now', '2026-09-28T12:00:00Z', '--out', out], { CLAUDE_CONFIG_DIR: FIXTURES, CDT_SHARE_BASE_URL: ORIGIN }, { fetchImpl: offline });
  assert.equal(result.published, undefined);
  assert.match(result.publishError, /could not reach cdt\.test \(ENOTFOUND\)/);
  assert.ok(result.share.url.startsWith(`${ORIGIN}/r?s=13&`));
  assert.match(text, /Not published/);
});
