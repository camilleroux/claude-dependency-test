import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, classifyUserLine } from '../scripts/lib/collect.mjs';
import { computeMetrics } from '../scripts/lib/metrics.mjs';
import { archetypeFor, linear, scoreMetrics, stageFor } from '../scripts/lib/score.mjs';
import { run } from '../scripts/diagnose.mjs';
import { decodeCard, encodeCard } from '../assets/card.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIX = path.join(HERE, 'fixtures', 'basic');
const CONFIG = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'config', 'scoring.json'), 'utf8'));
const NOW = Date.parse('2026-09-28T12:00:00Z');
const close = (actual, expected, eps = 1e-6) => assert.ok(Math.abs(actual - expected) < eps, `${actual} ≉ ${expected}`);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cdt-'));

async function fixtureMetrics(opts = {}) {
  const collected = await collect(path.join(FIX, 'projects'));
  const computed = computeMetrics(collected, { now: NOW, timeZone: 'UTC', cleanupPeriodDays: 30, config: CONFIG, ...opts });
  return { collected, computed };
}

test('collect: de-duplicates resumed sessions and multi-line API responses', async () => {
  const { collected } = await fixtureMetrics();
  assert.equal(collected.quality.files, 4);
  assert.equal(collected.quality.duplicateLinesSkipped, 2); // u2 + a4 copied into the resumed session
  assert.equal(collected.quality.unparseableLines, 1);
  // msg_1 spans two lines but is one response; synthetic limit messages are not models.
  const ids = collected.modelEvents.map((e) => e.model);
  assert.equal(ids.length, 8); // 7 in window + 1 outside
  assert.equal(collected.limitEvents.length, 2);
});

test('collect: only prompts typed by a human are counted', async () => {
  const { collected } = await fixtureMetrics();
  assert.equal(collected.quality.promptsFromOriginField, 4); // u1 u2 u5 u6 (u2 copy skipped)
  assert.equal(collected.quality.promptsFromLegacyHeuristic, 2); // old1 + l1
  assert.equal(collected.prompts.length, 6);
});

test('classifyUserLine: tool results, meta, sidechain, notifications and injected tags are not prompts', () => {
  const u = (extra) => ({ type: 'user', message: { role: 'user', content: 'hi' }, ...extra });
  assert.equal(classifyUserLine(u({ origin: { kind: 'human' } })), 'human');
  assert.equal(classifyUserLine(u({ origin: { kind: 'task-notification' } })), null);
  assert.equal(classifyUserLine(u({ origin: { kind: 'human' }, isMeta: true })), null);
  assert.equal(classifyUserLine(u({ isSidechain: true })), null);
  assert.equal(classifyUserLine(u({ isCompactSummary: true })), null);
  assert.equal(classifyUserLine(u({ promptSource: 'sdk' })), null);
  assert.equal(classifyUserLine(u({ promptSource: 'queued' })), 'human');
  assert.equal(classifyUserLine(u({ message: { content: [{ type: 'tool_result', content: 'x' }] } })), null);
  assert.equal(classifyUserLine(u({ message: { content: '<bash-stdout>x</bash-stdout>' } })), null);
  assert.equal(classifyUserLine(u({ message: { content: [{ type: 'text', text: '[Request interrupted by user]' }] } })), null);
  assert.equal(classifyUserLine(u({ message: { content: [{ type: 'image', source: {} }, { type: 'text', text: '[Image #1] look' }] } })), 'legacy-human');
});

test('metrics: window, sessions, shares and streaks', async () => {
  const { computed } = await fixtureMetrics();
  const m = computed.metrics;
  assert.equal(computed.window.startDay, '2026-09-20');
  assert.equal(computed.window.days, 9);
  assert.equal(computed.window.clampedToRetention, true); // the July line was ignored
  assert.equal(computed.extras.prompts, 5);
  assert.equal(computed.extras.sessions, 4); // 30-min gaps split s1 in two
  close(computed.extras.totalActiveHours, 2550 / 3600);
  close(m.activeHoursPerActiveDay.value, 2550 / 3600 / 4);
  close(m.activeDaysShare.value, 4 / 9);
  assert.equal(m.longestStreakDays.value, 3);
  assert.equal(computed.extras.currentStreak, 3);
  close(m.nightPromptShare.value, 1 / 5);
  close(m.promptsPerActiveDay.value, 5 / 4);
  close(m.weekendActivityShare.value, 150 / 2550);
  assert.equal(m.limitHitsPer30Days.limitHits, 1); // two error lines, same reset window
  close(m.limitHitsPer30Days.value, 30 / 9);
  close(m.opusShare.value, 4 / 7); // sidechain opus counted, synthetic and out-of-window excluded
  assert.equal(computed.extras.peakHour, 9);
});

test('metrics: usage stats are real counts, de-duplicated and windowed', async () => {
  const { computed } = await fixtureMetrics();
  const u = computed.usage;
  assert.deepEqual(u.toolCalls, { Bash: 1 });
  assert.equal(u.outputTokens, 7 * 20); // 7 responses in the window, msg_1's two lines counted once
  assert.equal(u.totalTokens, 7 * 30);
  assert.equal(u.subagents, 1);
  assert.equal(u.compactions, 1);
  assert.equal(u.interruptions, 1); // the "[Request interrupted" marker, not a prompt
  close(u.longestTurnMinutes, 1.5);
  close(u.claudeHours, 90 / 3600);
  assert.equal(u.projects, 2);
  assert.equal(u.latestNightMinute, 30); // 00:30 is later in the night than 23:50
  assert.equal(u.earliestMorningMinute, 9 * 60);
});

test('metrics: time zone changes local hours and days', async () => {
  const { computed } = await fixtureMetrics({ timeZone: 'America/Los_Angeles' });
  // In LA (UTC-7) 00:30Z becomes 17:30, while 09:00Z and 09:25Z become 02:00 and 02:25.
  close(computed.metrics.nightPromptShare.value, 2 / 5);
  assert.equal(computed.extras.peakHour, 2);
});

test('metrics: --days narrows the window and unreliable metrics are omitted, not zeroed', async () => {
  const { computed } = await fixtureMetrics({ maxDays: 3 });
  assert.equal(computed.window.days, 3);
  assert.equal(computed.metrics.activeDaysShare.available, false);
  assert.equal(computed.metrics.weekendActivityShare.available, false);
  assert.equal(computed.metrics.nightPromptShare.available, false); // 4 prompts < 5
  assert.equal(computed.metrics.activeDaysShare.value, null);
});

test('metrics: usage limits are "not detectable" when transcripts carry no error markers', async () => {
  const dir = tmp();
  const lines = [];
  for (let i = 0; i < 6; i++) {
    const ts = new Date(NOW - i * 3_600_000).toISOString();
    lines.push({ type: 'user', uuid: `u${i}`, timestamp: ts, origin: { kind: 'human' }, message: { content: 'x' } });
    lines.push({ type: 'assistant', uuid: `a${i}`, timestamp: ts, message: { id: `m${i}`, model: 'claude-sonnet-5' } });
  }
  fs.mkdirSync(path.join(dir, 'p'));
  fs.writeFileSync(path.join(dir, 'p', 's.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n'));
  const computed = computeMetrics(await collect(dir), { now: NOW, timeZone: 'UTC', cleanupPeriodDays: 30, config: CONFIG });
  assert.equal(computed.metrics.limitHitsPer30Days.available, false);
  assert.match(computed.metrics.limitHitsPer30Days.reason, /no rate-limit/);
});

test('score: linear thresholds, renormalization, stage and archetype', async () => {
  assert.equal(linear(0.5, 0.5, 8), 0);
  assert.equal(linear(8, 0.5, 8), 1);
  assert.equal(linear(100, 0.5, 8), 1);
  close(linear(4.25, 0.5, 8), 0.5);

  const { computed } = await fixtureMetrics();
  const s = scoreMetrics(computed.metrics, computed.window.days, CONFIG);
  const earned = Object.fromEntries(s.breakdown.map((b) => [b.key, b.earned]));
  close(earned.hours, 0); // 0.18 h per active day, below the 0.5 h floor
  close(earned.streak, 15 / 7); // 3-day streak, target capped to the 9-day window
  close(earned.presence, (10 * (4 / 9 - 0.15)) / 0.75);
  close(earned.intensity, 0);
  close(earned.marathon, 0); // longest session 40 min
  close(earned.delegation, (10 * 0.25) / 8); // 1 subagent over 4 active days
  close(earned.output, 0); // 26 words per day
  close(earned.limits, (10 * (30 / 9)) / 8);
  close(earned.opus, (5 * 4) / 7);
  assert.equal(s.total, 13);
  assert.equal(s.renormalized, false);
  assert.equal(stageFor(s.total, CONFIG), 1);
  assert.equal(archetypeFor(s.breakdown, CONFIG).slug, 'opus-affluenza');

  // Drop a criterion: the total is renormalized over the remaining 95 points.
  const partial = structuredClone(computed.metrics);
  partial.opusShare = { available: false, value: null, reason: 'test' };
  const s2 = scoreMetrics(partial, computed.window.days, CONFIG);
  assert.equal(s2.availablePoints, 95);
  assert.equal(s2.renormalized, true);
  assert.equal(s2.total, Math.round(((s.earnedPoints - earned.opus) / 95) * 100));
});

test('score: stage boundaries and fallback archetype', () => {
  assert.deepEqual([0, 20, 21, 40, 41, 60, 61, 80, 81, 100].map((n) => stageFor(n, CONFIG)), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  const low = [{ key: 'hours', available: true, ratio: 0.1, points: 25 }];
  assert.equal(archetypeFor(low, CONFIG).slug, 'recreational-use');
  const tie = [
    { key: 'presence', available: true, ratio: 0.9, points: 10 },
    { key: 'hours', available: true, ratio: 0.9, points: 20 },
  ];
  assert.equal(archetypeFor(tie, CONFIG).slug, 'deep-focus');
});

test('share card: round-trips and rejects junk', () => {
  const card = { score: 73, stage: 4, archetype: 'hypergraphia', days: 30, sym: { h: 5.2, ad: 87, sk: 12, n: 18, o: 64 } };
  assert.deepEqual(decodeCard(encodeCard(card)), card);
  assert.equal(decodeCard('s=101&st=4&a=hypergraphia'), null);
  assert.equal(decodeCard('s=50&st=4&a=<script>'), null);
  assert.equal(decodeCard('s=50&st=4&a=__proto__'), null);
  assert.deepEqual(decodeCard('s=50&st=3&a=deep-focus&h=abc&n=-3&p=12').sym, { p: 12 });
});

test('end to end: CLAUDE_CONFIG_DIR is honored and no secret ever reaches the output', async () => {
  const out = tmp();
  const { result, text } = await run(['--json', '--no-publish', '--tz', 'UTC', '--now', '2026-09-28T12:00:00Z', '--out', out], {
    CLAUDE_CONFIG_DIR: FIX,
    CDT_SHARE_BASE_URL: 'https://share.test',
  });
  assert.equal(result.score, 13);
  assert.equal(result.stage.name, 'Casual User');
  assert.equal(result.archetype.slug, 'opus-affluenza');
  assert.equal(result.window.cleanupPeriodDays, 30);
  assert.ok(result.share.url.startsWith('https://share.test/r?s=13&st=1&a=opus-affluenza&d=9&'));
  // Share URL encodes exactly the symptoms shown on the card, nothing else.
  const keys = [...new URL(result.share.url).searchParams.keys()];
  assert.deepEqual(keys.filter((k) => !['s', 'st', 'a', 'd', 'v'].includes(k)).sort(), Object.keys(result.card.sym).sort());
  assert.ok(Object.keys(result.card.sym).length >= 4);

  const html = fs.readFileSync(path.join(out, 'report.html'), 'utf8');
  for (const blob of [JSON.stringify(result), text, html]) {
    assert.ok(!/SECRET|alice|toolu_|msg_|req_/.test(blob), 'leaked transcript data');
  }
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /Save as PNG/);
});

test('streaming: handles a transcript of several tens of MB', async () => {
  const dir = tmp();
  fs.mkdirSync(path.join(dir, 'p'));
  const file = path.join(dir, 'p', 'big.jsonl');
  const fd = fs.openSync(file, 'w');
  const padding = 'x'.repeat(400);
  let chunk = '';
  const N = 100_000;
  for (let i = 0; i < N; i++) {
    const ts = new Date(NOW - (N - i) * 10_000).toISOString();
    chunk += JSON.stringify({ type: 'assistant', uuid: `a${i}`, timestamp: ts, message: { id: `m${i >> 1}`, model: 'claude-opus-5', content: [{ type: 'text', text: padding }] } }) + '\n';
    if (i % 5000 === 4999) {
      fs.writeSync(fd, chunk);
      chunk = '';
    }
  }
  fs.closeSync(fd);
  assert.ok(fs.statSync(file).size > 40_000_000);
  const c = await collect(dir);
  assert.equal(c.activity.length, N);
  assert.equal(c.modelEvents.length, N / 2);
});
