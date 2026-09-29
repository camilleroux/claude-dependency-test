import { test } from 'node:test';
import assert from 'node:assert/strict';
import handleCase from '../api/d.js';
import handleResult from '../api/r.js';
import { detectLang } from '../lib/layout.js';
import { shareText } from '../public/card.js';

const req = (url, acceptLanguage) => new Request(url, { headers: acceptLanguage ? { 'accept-language': acceptLanguage } : {} });

test('language comes from ?lang first, then the first Accept-Language preference', () => {
  assert.equal(detectLang(req('https://x.test/case/demo', 'fr-FR,fr;q=0.9,en;q=0.8')), 'fr');
  assert.equal(detectLang(req('https://x.test/case/demo', 'en-US,en;q=0.9,fr;q=0.8')), 'en');
  assert.equal(detectLang(req('https://x.test/case/demo', 'en;q=0.5,fr-CA;q=0.9')), 'fr');
  assert.equal(detectLang(req('https://x.test/case/demo')), 'en'); // link-preview bots
  assert.equal(detectLang(req('https://x.test/case/demo?lang=en', 'fr-FR')), 'en');
  assert.equal(detectLang(req('https://x.test/case/demo?lang=fr')), 'fr');
});

test('case page renders in French for French browsers, stays out of shared caches and links both versions', async () => {
  const res = await handleCase(req('https://x.test/case/demo', 'fr-FR,fr;q=0.9'));
  const html = await res.text();
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /Dépendance à Claude/);
  assert.match(html, /hreflang="en" href="https:\/\/x.test\/case\/demo"/);
  assert.match(html, /hreflang="fr" href="https:\/\/x.test\/case\/demo\?lang=fr"/);
  assert.doesNotMatch(html, /undefined|NaN/);
  assert.match(res.headers.get('cache-control'), /^private/);
  assert.equal(res.headers.get('vary'), 'Accept-Language');

  const en = await handleCase(req('https://x.test/case/demo?lang=en', 'fr-FR'));
  assert.match(await en.text(), /<html lang="en">/);
  assert.match(en.headers.get('cache-control'), /^public/);
});

test('/r and the share text follow the language', async () => {
  const html = await (await handleResult(req('https://x.test/r?s=73&st=4&a=streak-dependency&d=30&v=1', 'fr'))).text();
  assert.match(html, /<html lang="fr">/);
  assert.match(html, /Stade 4/);
  const card = { score: 73, stage: 4, archetype: 'streak-dependency' };
  assert.match(shareText(card, 'fr'), /Et toi, à quel point es-tu accro à Claude \?/);
  assert.match(shareText(card), /How addicted to Claude are you\?/);
});

test('French case pages recommend a Human Coders training matched to the diagnosis, English ones do not', async () => {
  const fr = await (await handleCase(req('https://x.test/case/demo?lang=fr'))).text();
  assert.match(fr, /Traitement recommandé/);
  assert.match(fr, /humancoders\.com\/formations\/claude-code-avance\?utm_source=claude-dependency-test&amp;utm_medium=referral&amp;utm_campaign=prescription/);
  const en = await (await handleCase(req('https://x.test/case/demo?lang=en'))).text();
  assert.doesNotMatch(en, /humancoders/);
});
