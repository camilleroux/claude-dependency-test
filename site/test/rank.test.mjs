import { test } from 'node:test';
import assert from 'node:assert/strict';
import api from '../api/diagnoses.js';
import page from '../api/d.js';
import stats from '../api/stats.js';
import { memoryStore } from '../lib/store.js';
import { recordScore } from '../lib/rank.js';
import { DEMO_REPORT } from '../lib/demo.js';
import { rankFrom, rankText, shareText } from '../public/card.js';

const ORIGIN = 'https://cdt.test';

test('rank needs a crowd, picks the flattering side and ignores ties', () => {
  assert.equal(rankFrom(3, 4, 8), null); // too few patients
  assert.deepEqual(rankFrom(15, 4, 20), { dir: 'more', pct: 75, total: 20 });
  assert.deepEqual(rankFrom(2, 15, 20), { dir: 'less', pct: 75, total: 20 });
  assert.equal(rankFrom(0, 0, 20), null); // everybody has the same score
  assert.equal(rankText({ dir: 'more', pct: 72, total: 30 }), 'More addicted than 72% of patients');
  assert.equal(rankText({ dir: 'less', pct: 80, total: 30 }, 'fr'), 'Plus raisonnable que 80 % des patients');
  assert.match(shareText({ ...DEMO_REPORT.card, rank: { dir: 'more', pct: 72, total: 30 } }), /More addicted than 72% of patients\./);
});

test('publishing ranks the score among published reports, deleting removes it', async () => {
  const store = memoryStore();
  globalThis.__cdtStore = store;
  for (let i = 0; i < 11; i++) await recordScore(store, `seed${i}`, i * 6); // 0..60, all below the demo's 72

  const res = await api(new Request(`${ORIGIN}/api/diagnoses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(DEMO_REPORT) }));
  const body = await res.json();
  assert.equal(res.status, 201);
  assert.deepEqual(body.rank, { dir: 'more', pct: 91, total: 12 });

  const en = await (await page(new Request(`${ORIGIN}/case/${body.slug}?lang=en`))).text();
  assert.match(en, /More addicted than 91% of patients/);
  const fr = await (await page(new Request(`${ORIGIN}/case/${body.slug}?lang=fr`))).text();
  assert.match(fr, /Plus accro que 91 % des patients/);
  assert.equal((await (await stats()).json()).patients, 12);

  const del = await api(new Request(`${ORIGIN}/api/diagnoses/${body.slug}`, { method: 'DELETE', headers: { authorization: `Bearer ${body.token}` } }));
  assert.equal(del.status, 204);
  assert.equal((await (await stats()).json()).patients, 11);
});
