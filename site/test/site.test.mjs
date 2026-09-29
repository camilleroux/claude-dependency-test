import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handleResult from '../api/r.js';
import handleBadge from '../api/badge.js';
import handleSeo from '../api/seo.js';
import { shareIntents } from '../public/card.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLUGIN = path.join(SITE, '..', 'plugins', 'claude-dependency-test');

test('site serves the exact same card module and scoring rules as the plugin (run `npm run sync` in site/)', () => {
  assert.equal(fs.readFileSync(path.join(SITE, 'public/card.js'), 'utf8'), fs.readFileSync(path.join(PLUGIN, 'assets/card.js'), 'utf8'));
  assert.equal(fs.readFileSync(path.join(SITE, 'public/scoring.json'), 'utf8'), fs.readFileSync(path.join(PLUGIN, 'config/scoring.json'), 'utf8'));
});

test('/r renders per-result OG tags from a canonicalized query', async () => {
  const res = handleResult(new Request('https://cdt.test/r?s=73&st=4&a=hypergraphia&d=30&h=5.2&n=18&junk=<b>&v=1'));
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<meta property="og:title" content="Stage 4: Chronic \(73\/100\) · Claude Dependency Test">/);
  assert.match(html, /og:image" content="https:\/\/cdt\.test\/og\?s=73&amp;st=4&amp;a=hypergraphia&amp;d=30&amp;h=5\.2&amp;n=18&amp;v=1"/);
  assert.ok(!html.includes('junk') && !html.includes('<b>'));
});

test('/r redirects home on invalid or hostile input', () => {
  for (const q of ['', '?s=101&st=4&a=hypergraphia', '?s=5&st=1&a="><script>alert(1)</script>']) {
    const res = handleResult(new Request(`https://cdt.test/r${q}`));
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://cdt.test/');
  }
});

test('/badge renders an SVG and ignores bad input', async () => {
  const ok = await (await handleBadge(new Request('https://cdt.test/badge?s=73&st=4'))).text();
  assert.match(ok, /stage 4 · 73\/100/);
  const bad = await (await handleBadge(new Request('https://cdt.test/badge?s=<x>&st=9'))).text();
  assert.match(bad, /take the test/);
  assert.ok(!bad.includes('<x>'));
});

test('share links credit the author and SEO files use the request origin', async () => {
  const i = shareIntents('https://cdt.test/case/abc', 'hello', { x: 'CamilleRoux', bluesky: 'camilleroux.com', mastodon: 'camilleroux@mastodon.social' });
  assert.match(i.x, /&via=CamilleRoux&related=CamilleRoux$/);
  assert.match(decodeURIComponent(i.bluesky), /via @camilleroux\.com$/);
  assert.match(decodeURIComponent(i.mastodon), /via @camilleroux@mastodon\.social$/);
  const robots = await (await handleSeo(new Request('https://cdt.test/api/seo?f=robots'))).text();
  assert.match(robots, /Sitemap: https:\/\/cdt\.test\/sitemap\.xml/);
  const sitemap = await (await handleSeo(new Request('https://cdt.test/api/seo?f=sitemap'))).text();
  assert.match(sitemap, /<loc>https:\/\/cdt\.test\/<\/loc>/);
  assert.ok(!sitemap.includes('/case/') || sitemap.includes('/case/demo'));
});
