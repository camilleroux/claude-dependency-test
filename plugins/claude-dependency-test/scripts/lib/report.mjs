// Builds the card, the terminal bulletin and the standalone HTML report from computed results.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCHETYPES,
  REPORT_VERSION,
  STAGES,
  METRICS,
  badgeUrl,
  formatHour,
  severityFlag as flag,
  headlines,
  shareIntents,
  shareText,
  shareUrl,
  usageFacts,
} from '../../assets/card.js';

const ASSETS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

const num = (v) => Math.round(v).toLocaleString('en-US');
const pct = (v) => `${Math.round(v * 100)}%`;

const CRITERION_SYMPTOMS = {
  hours: (m) => ({ h: Math.round(m.activeHoursPerActiveDay.value * 10) / 10 }),
  streak: (m) => ({ sk: m.longestStreakDays.value }),
  presence: (m) => ({ ad: Math.round(m.activeDaysShare.value * 100) }),
  intensity: (m) => ({ p: Math.round(m.promptsPerActiveDay.value) }),
  marathon: (m) => ({ ls: Math.round(m.longestSessionHours.value * 10) / 10 }),
  delegation: (m) => ({ sa: m.subagentsPerActiveDay.subagents }),
  output: (m) => ({ wd: Math.round(m.wordsPerActiveDay.value) }),
  limits: (m) => ({ l: m.limitHitsPer30Days.limitHits }),
  opus: (m) => ({ o: Math.round(m.opusShare.value * 100) }),
};

/** Card = what gets drawn and what the share URL encodes: the 5 most severe symptoms. */
export function buildCard({ score, stage, archetype, breakdown, metrics, windowDays }) {
  const top = breakdown
    .filter((b) => b.available)
    .sort((a, b) => b.ratio - a.ratio || b.points - a.points)
    .slice(0, 5);
  const sym = {};
  for (const b of top) Object.assign(sym, CRITERION_SYMPTOMS[b.key](metrics));
  return { score, stage, archetype, days: windowDays, sym };
}

const pad = (s, n) => (s.length >= n ? s : s + ' '.repeat(n - s.length));

export function renderBulletin(r) {
  const W = 74;
  const line = '─'.repeat(W);
  const out = [];
  const box = (l, rt = '') => `│ ${pad(l, W - 4 - rt.length)}${rt} │`;
  out.push(`┌${'─'.repeat(W - 2)}┐`);
  out.push(box('CLAUDE DEPENDENCY TEST', 'LABORATORY REPORT'));
  out.push(box('How addicted to Claude are you?', 'Rx'));
  out.push(`└${'─'.repeat(W - 2)}┘`);
  const w = r.window;
  out.push(`  Specimen      anonymous developer (computed locally, nothing uploaded)`);
  out.push(`  Observation   ${w.days} day${w.days === 1 ? '' : 's'} · ${w.startDay} → ${w.endDay} · ${w.timeZone}`);
  out.push(`  Sample        ${num(r.sample.prompts)} prompts · ${num(r.sample.sessions)} sessions · ${r.sample.activeDays} active days · ${r.sample.totalActiveHours.toFixed(1)} h`);
  out.push('');
  const filled = Math.round(r.score / 5);
  out.push(`  DEPENDENCY SCORE   ${r.score}/100   [${'█'.repeat(filled)}${'░'.repeat(20 - filled)}]`);
  out.push(`  STAGE              ${r.stage.number} of 5 — ${r.stage.name}`);
  out.push(`  DIAGNOSIS          ${r.archetype.name} ${r.archetype.emoji}  (${r.archetype.code})`);
  if (r.headlines.length) {
    out.push('');
    out.push('  HEADLINES');
    for (const h of r.headlines) out.push(`  ${pad(h.value, 10)}${pad(h.label, 26)}${h.hint}`);
  }
  out.push('');
  out.push(`  ${pad('SYMPTOM', 27)}${pad('RESULT', 12)}${pad('REFERENCE', 13)}${pad('POINTS', 10)}FLAG`);
  out.push(`  ${line.slice(0, W - 4)}`);
  for (const b of r.breakdown) {
    if (!b.available) continue;
    b.parts.forEach((p, i) => {
      const f = METRICS[p.metric];
      const pts = i === 0 ? `${b.earned.toFixed(1)}/${b.points}` : '';
      const fl = i === 0 ? flag(b.ratio) : '';
      out.push(`  ${pad(f.label, 27)}${pad(f.value(p.value), 12)}${pad(f.ref(p.from, p.to), 13)}${pad(pts, 10)}${fl}`);
    });
  }
  const missing = r.breakdown.filter((b) => !b.available);
  if (missing.length) {
    out.push('');
    out.push(`  NOT ASSESSED (score renormalized over ${r.points.available}/${r.points.max} pts)`);
    for (const b of missing) out.push(`  · ${b.label}: ${b.reason}`);
  }
  out.push('');
  out.push(`  Peak hour     ${formatHour(r.extras.peakHour)}`);
  const mix = Object.entries(r.extras.modelMix)
    .filter(([, v]) => v >= 0.005)
    .map(([k, v]) => `${k[0].toUpperCase()}${k.slice(1)} ${pct(v)}`)
    .join(' · ');
  if (mix) out.push(`  Model mix     ${mix}`);
  out.push(`  Streak now    ${r.extras.currentStreak} day${r.extras.currentStreak === 1 ? '' : 's'} · longest session ${r.extras.longestSessionHours.toFixed(1)} h`);
  const facts = usageFacts(r.usage);
  if (facts.length) {
    out.push('');
    out.push('  USAGE');
    for (const f of facts) out.push(`  ${pad(f.value, 16)}${f.label}`);
  }
  if (w.likelyTruncatedByCleanup || w.clampedToRetention) {
    out.push('');
    out.push(`  Note: Claude Code deletes transcripts after ${w.cleanupPeriodDays} days (cleanupPeriodDays),`);
    out.push(`  so the observation window starts on ${w.startDay}.`);
  }
  out.push('');
  out.push('  Not an actual medical diagnosis. Side effects may include shipping.');
  return out.join('\n');
}

/** Closing lines of the terminal output: share invite and follow links. */
export function renderShareFooter(r) {
  const lines = ['', '  SPREAD THE DIAGNOSIS', `  Post it on X: ${r.share.intents.x}`, `  Your case file: ${r.share.url}`];
  if (r.follow.length) lines.push('', `  Follow the doctor: ${r.follow.map((f) => `${f.network} ${f.handle}`).join(' · ')}`);
  return lines.join('\n');
}

export function buildResult({ computed, scored, stage, archetype, config, baseUrl, generatedAt, version }) {
  const card = buildCard({
    score: scored.total,
    stage,
    archetype: archetype.slug,
    breakdown: scored.breakdown,
    metrics: computed.metrics,
    windowDays: computed.window.days,
  });
  const url = shareUrl(baseUrl, card);
  const ar = ARCHETYPES[archetype.slug];
  const result = {
    tool: 'claude-dependency-test',
    version,
    generatedAt,
    score: scored.total,
    stage: { number: stage, name: STAGES[stage].name, prognosis: STAGES[stage].prognosis },
    archetype: { slug: archetype.slug, name: ar.name, code: ar.code, emoji: ar.emoji, tagline: ar.tagline, dominantCriterion: archetype.dominant },
    window: computed.window,
    sample: {
      prompts: computed.extras.prompts,
      sessions: computed.extras.sessions,
      activeDays: computed.extras.activeDays,
      totalActiveHours: computed.extras.totalActiveHours,
    },
    points: { earned: scored.earnedPoints, available: scored.availablePoints, max: scored.maxPoints, renormalized: scored.renormalized },
    breakdown: scored.breakdown,
    usage: {
      ...computed.usage,
      longestTurnMinutes: Math.round(computed.usage.longestTurnMinutes * 10) / 10,
      claudeHours: Math.round(computed.usage.claudeHours * 10) / 10,
    },
    extras: {
      peakHour: computed.extras.peakHour,
      currentStreak: computed.extras.currentStreak,
      longestSessionHours: computed.extras.longestSessionHours,
      modelMix: computed.extras.modelMix,
      limitHits: computed.extras.limitHits,
      peakWeekday: computed.extras.peakWeekday,
      busiestDay: computed.extras.busiestDay,
      promptsByDay: computed.extras.promptsByDay,
      promptsByHour: computed.extras.promptsByHour,
      promptsByWeekday: computed.extras.promptsByWeekday,
    },
    card,
    share: { url, text: shareText(card), badge: badgeUrl(baseUrl, card), siteLabel: siteLabel(baseUrl) },
    author: config.share.author || { via: {} },
    follow: (config.share.follow || []).filter((f) => f && f.url).map(({ network, handle, url: link }) => ({ network, handle, url: link })),
  };
  finalizeShare(result);
  result.headlines = headlines(result);
  result.bulletin = renderBulletin(result);
  return result;
}

/** Ready-to-post text and one-click share links, for whatever URL the report ends up at. */
export function finalizeShare(result) {
  result.share.post = `${result.share.text}\n${result.share.url}`;
  result.share.intents = shareIntents(result.share.url, result.share.text, result.author.via);
  return result;
}

/**
 * The aggregate payload published to the share site: numbers and enum values only
 * (see sanitizeReport in assets/card.js, which the server applies too).
 */
export function toPublicReport(r) {
  const round = (v) => Math.round(v * 1000) / 1000;
  return {
    v: REPORT_VERSION,
    score: r.score,
    stage: r.stage.number,
    archetype: r.archetype.slug,
    card: r.card,
    window: { days: r.window.days, startDay: r.window.startDay, endDay: r.window.endDay },
    sample: {
      prompts: r.sample.prompts,
      sessions: r.sample.sessions,
      activeDays: r.sample.activeDays,
      activeHours: round(r.sample.totalActiveHours),
    },
    criteria: r.breakdown.map((b) =>
      b.available
        ? { key: b.key, points: b.points, earned: round(b.earned), parts: b.parts.map((p) => ({ metric: p.metric, value: round(p.value), from: p.from, to: p.to })) }
        : { key: b.key, points: b.points, earned: null, parts: [] },
    ),
    extras: {
      peakHour: r.extras.peakHour,
      peakWeekday: r.extras.peakWeekday,
      currentStreak: r.extras.currentStreak,
      longestSessionHours: round(r.extras.longestSessionHours),
      busiestDay: r.extras.busiestDay,
    },
    modelMix: Object.fromEntries(Object.entries(r.extras.modelMix).map(([k, v]) => [k, round(v)])),
    usage: r.usage,
    hours: r.extras.promptsByHour,
    weekdays: r.extras.promptsByWeekday,
    daily: r.extras.promptsByDay,
  };
}

export function siteLabel(baseUrl) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return '';
  }
}

export function renderHtml(result) {
  const template = fs.readFileSync(path.join(ASSETS, 'report.template.html'), 'utf8');
  const cardJs = fs.readFileSync(path.join(ASSETS, 'card.js'), 'utf8');
  // Fonts are inlined (the page's Content-Security-Policy forbids any network request).
  const font = (file, family) =>
    `@font-face { font-family: '${family}'; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(ASSETS, 'fonts', file)).toString('base64')}) format('woff2'); }`;
  const fonts = [font('VT323-400.woff2', 'VT323'), font('IBMPlexMono-400.woff2', 'IBM Plex Mono')].join('\n');
  const rows = [];
  for (const b of result.breakdown) {
    if (!b.available) {
      rows.push({ label: b.label, value: 'not assessed', ref: b.reason, points: `–/${b.points}`, flag: '' });
      continue;
    }
    b.parts.forEach((p, i) => {
      const f = METRICS[p.metric];
      rows.push({
        label: f.label,
        value: f.value(p.value),
        ref: f.ref(p.from, p.to),
        points: i === 0 ? `${b.earned.toFixed(1)}/${b.points}` : '',
        flag: i === 0 ? flag(b.ratio) : '',
      });
    });
  }
  const data = {
    card: result.card,
    share: result.share,
    window: result.window,
    sample: result.sample,
    rows,
    peakHour: formatHour(result.extras.peakHour),
    modelMix: result.extras.modelMix,
    renormalized: result.points.renormalized,
    published: result.published ? { url: result.published.url } : null,
    ecg: result.extras.promptsByDay,
    headlines: result.headlines.slice(0, 4),
    author: result.author,
    facts: usageFacts(result.usage),
  };
  // JSON is embedded in a <script>; escape "<" so no value can close the tag.
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return template
    .replace('/*__FONTS__*/', () => fonts)
    .replace('/*__CARD_JS__*/', () => cardJs)
    .replace('"__DATA_JSON__"', () => json);
}

