// Server-rendered infographics for /case/:slug. Plain SVG/HTML strings: fast, readable without
// JavaScript, theme-aware through CSS variables. Hover details use native <title> tooltips.
// Every value comes from the sanitized report (numbers and fixed labels only).
import { ARCHETYPES, ARCHETYPES_FR, CRITERIA, MODEL_FAMILIES, STAGES, STAGES_FR, ecgPoints, formatHour, formatMinuteOfDay } from '../public/card.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const fmt = (n, lang = 'en') => Math.round(n).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const loc = (lang) => (lang === 'fr' ? 'fr-FR' : 'en-US');
const r1 = (n) => Math.round(n * 10) / 10;
const DAY_MS = 86_400_000;

// ---------------------------------------------------------------------------
/** The five stages as one scale, with a marker at the score. */
export function stageScale(score, stage, lang = 'en') {
  const names = lang === 'fr' ? STAGES_FR : STAGES;
  const segs = [1, 2, 3, 4, 5]
    .map((i) => `<div class="scale-seg${i === stage ? ' on' : ''}" style="--c:var(--s${i})"></div>`)
    .join('');
  const labels = [1, 2, 3, 4, 5]
    .map((i) => `<span${i === stage ? ' class="on"' : ''}>${esc(names[i].name)}</span>`)
    .join('');
  return `<div class="scale" role="img" aria-label="${lang === 'fr' ? `Score ${score} sur 100, stade ${stage} sur 5` : `Score ${score} out of 100, stage ${stage} of 5`}">
  <div class="scale-bar">${segs}<div class="scale-marker" style="left:${Math.min(99.4, Math.max(0.6, score))}%"></div></div>
  <div class="scale-labels" aria-hidden="true">${labels}</div>
</div>`;
}

// ---------------------------------------------------------------------------
/** Calendar of the window: one dot per day, darker = more prompts, current streak ringed. */
export function attendance(r, lang = 'en') {
  const fr = lang === 'fr';
  const start = Date.parse(`${r.window.startDay}T00:00:00Z`);
  const offset = (new Date(start).getUTCDay() + 6) % 7; // Monday first
  const max = Math.max(1, ...r.daily);
  // The current streak ends today, or yesterday if today has no prompt yet.
  const last = r.daily.length - 1;
  const streakEnd = r.daily[last] > 0 ? last : last - 1;
  const streakStart = streakEnd - r.extras.currentStreak + 1;
  const head = (fr ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S']).map((d) => `<b>${d}</b>`).join('');
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<i></i>');
  r.daily.forEach((v, i) => {
    const d = new Date(start + i * DAY_MS);
    const level = v === 0 ? 0 : Math.min(4, 1 + Math.floor((v / max) * 3.999));
    const streak = r.extras.currentStreak > 0 && i >= streakStart && i <= streakEnd;
    const label = `${d.toLocaleDateString(loc(lang), { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}${fr ? ' : ' : ': '}${fmt(v, lang)} prompt${v === 1 ? '' : 's'}`;
    cells.push(`<span class="day l${level}${streak ? ' streak' : ''}" style="--i:${i}" title="${esc(label)}">${d.getUTCDate()}</span>`);
  });
  return `<div class="cal" role="img" aria-label="${esc(fr ? `Actif ${r.sample.activeDays} jours sur ${r.window.days}, série en cours de ${r.extras.currentStreak} jours` : `Active on ${r.sample.activeDays} of ${r.window.days} days, current streak ${r.extras.currentStreak} days`)}">
  <div class="cal-grid">${head}${cells.join('')}</div>
  <div class="cal-key" aria-hidden="true"><span><i class="day l0"></i> ${fr ? 'aucun prompt' : 'no prompt'}</span><span><i class="day l1"></i><i class="day l2"></i><i class="day l3"></i><i class="day l4"></i> ${fr ? 'plus de prompts' : 'more prompts'}</span><span><i class="day l4 streak"></i> ${fr ? 'série en cours' : 'current streak'}</span></div>
</div>`;
}

// ---------------------------------------------------------------------------
const pt = (c, r, deg) => {
  const a = (deg * Math.PI) / 180;
  return `${r1(c + r * Math.cos(a))},${r1(c + r * Math.sin(a))}`;
};
function sector(c, rIn, rOut, a0, a1) {
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(c, rIn, a0)} L${pt(c, rOut, a0)} A${rOut},${rOut} 0 ${large} 1 ${pt(c, rOut, a1)} L${pt(c, rIn, a1)} A${rIn},${rIn} 0 ${large} 0 ${pt(c, rIn, a0)} Z`;
}

/** 24-hour clock: one petal per hour, length = prompts. Midnight at the top. */
export function radialClock(hours, peakHour, lang = 'en') {
  const fr = lang === 'fr';
  const S = 400;
  const c = S / 2;
  const r0 = 70;
  const rMax = 166;
  const max = Math.max(1, ...hours);
  const deg = (h) => h * 15 - 90;
  const petals = hours
    .map((v, h) => {
      const len = v > 0 ? Math.max(3, ((rMax - r0) * v) / max) : 0;
      if (!len) return '';
      const night = h < 5;
      return `<path class="petal" style="--i:${h}" d="${sector(c, r0, r0 + len, deg(h) + 1.2, deg(h + 1) - 1.2)}" fill="${night ? 'var(--accent)' : 'var(--bar)'}"><title>${fr ? `${formatHour(h, lang)} à ${formatHour((h + 1) % 24, lang)} : ${fmt(v, lang)} prompts` : `${formatHour(h)} to ${formatHour((h + 1) % 24)}: ${fmt(v)} prompts`}</title></path>`;
    })
    .join('');
  const labels = [
    [0, fr ? '0 h' : '12 AM'],
    [6, fr ? '6 h' : '6 AM'],
    [12, fr ? '12 h' : '12 PM'],
    [18, fr ? '18 h' : '6 PM'],
  ]
    .map(([h, t]) => {
      const a = (deg(h) * Math.PI) / 180;
      const x = r1(c + (rMax + 20) * Math.cos(a));
      const y = r1(c + (rMax + 20) * Math.sin(a) + 4);
      return `<text x="${x}" y="${y}" text-anchor="middle">${t}</text>`;
    })
    .join('');
  const ticks = Array.from({ length: 24 }, (_, h) => `<line x1="${pt(c, r0 - 6, deg(h)).split(',')[0]}" y1="${pt(c, r0 - 6, deg(h)).split(',')[1]}" x2="${pt(c, r0 - (h % 6 ? 2 : 10), deg(h)).split(',')[0]}" y2="${pt(c, r0 - (h % 6 ? 2 : 10), deg(h)).split(',')[1]}" class="tick"/>`).join('');
  return `<svg class="clock" viewBox="0 0 ${S} ${S}" role="img" aria-label="${esc(fr ? `Prompts par heure de la journée. Pic à ${formatHour(peakHour, lang)}.` : `Prompts by hour of day. Peak at ${formatHour(peakHour)}.`)}">
  <path d="${sector(c, r0, rMax, deg(0), deg(5))}" class="night-zone"><title>${fr ? 'Garde de nuit : de minuit à 5 h' : 'Night shift: midnight to 5 AM'}</title></path>
  <circle cx="${c}" cy="${c}" r="${r0}" class="face"/>
  ${ticks}${petals}${labels}
  <text x="${c}" y="${c - 2}" text-anchor="middle" class="clock-big">${formatHour(peakHour, lang)}</text>
  <text x="${c}" y="${c + 22}" text-anchor="middle" class="clock-small">${fr ? 'heure de pointe' : 'peak hour'}</text>
</svg>`;
}

/** "Your Claude day": first and last prompt times on a 6 AM to 6 AM strip. */
export function dayStrip(earliest, latest, lang = 'en') {
  const fr = lang === 'fr';
  if (earliest == null && latest == null) return '';
  const pos = (m) => (((m - 360 + 1440) % 1440) / 1440) * 100;
  const from = earliest != null ? pos(earliest) : 0;
  const to = latest != null ? pos(latest) : 100;
  const ticks = [
    [0, fr ? '6 h' : '6 AM'],
    [25, fr ? '12 h' : '12 PM'],
    [50, fr ? '18 h' : '6 PM'],
    [75, fr ? '0 h' : '12 AM'],
    [100, fr ? '6 h' : '6 AM'],
  ]
    .map(([p, t]) => `<span style="left:${p}%">${t}</span>`)
    .join('');
  const pin = (p, t, label, cls) => `<div class="pin ${cls}" style="left:${p}%"><b>${esc(t)}</b><small>${esc(label)}</small></div>`;
  return `<div class="daystrip" role="img" aria-label="${esc(fr ? `Premier prompt ${earliest != null ? formatMinuteOfDay(earliest, lang) : 'inconnu'}, dernier ${latest != null ? formatMinuteOfDay(latest, lang) : 'inconnu'}` : `Earliest prompt ${earliest != null ? formatMinuteOfDay(earliest) : 'unknown'}, latest ${latest != null ? formatMinuteOfDay(latest) : 'unknown'}`)}">
  <div class="daystrip-track"><div class="daystrip-night"></div><div class="daystrip-on" style="left:${from}%;width:${Math.max(1, to - from)}%"></div></div>
  ${earliest != null ? pin(from, formatMinuteOfDay(earliest, lang), fr ? 'premier prompt' : 'earliest start', 'start') : ''}
  ${latest != null ? pin(to, formatMinuteOfDay(latest, lang), fr ? 'dernier prompt' : 'latest prompt', 'end') : ''}
  <div class="daystrip-ticks" aria-hidden="true">${ticks}</div>
</div>`;
}

// ---------------------------------------------------------------------------
const ICONS = {
  book: '<svg viewBox="0 0 24 24"><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5z"/><path d="M5 21.5A2.5 2.5 0 0 1 7.5 19H19v3H7.5A2.5 2.5 0 0 1 5 21.5z" opacity=".55"/></svg>',
  person: '<svg viewBox="0 0 24 24"><circle cx="12" cy="7" r="4.2"/><path d="M3.5 22a8.5 8.5 0 0 1 17 0z"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M2 6.5A2.5 2.5 0 0 1 4.5 4H9l2.2 2.4h8.3A2.5 2.5 0 0 1 22 8.9v9.6a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5z"/></svg>',
  key: '<svg viewBox="0 0 30 24"><rect x="1" y="1" width="28" height="22" rx="5"/><text x="15" y="16" text-anchor="middle" font-size="9" font-family="ui-monospace,Menlo,monospace" font-weight="700" fill="var(--panel)">esc</text></svg>',
};
function niceUnit(x) {
  for (const m of [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000]) if (m >= x) return m;
  return 10 ** Math.ceil(Math.log10(x));
}

/** Repeated icons, one per unit. Returns '' when there's nothing to show. */
export function pictogram(count, icon, { max = 48, one, many, unitNoun, lang = 'en' }) {
  if (!(count > 0)) return '';
  const unit = count <= max ? 1 : niceUnit(count / max);
  const n = Math.max(1, Math.round(count / unit));
  const key = unit > 1 ? (lang === 'fr' ? `Chaque ${one} = ${fmt(unit, lang)} ${unitNoun || many}` : `Each ${one} = ${fmt(unit)} ${unitNoun || many}`) : '';
  return `<div class="picto is-${icon}" role="img" aria-label="${esc(`${fmt(count, lang)} ${many}`)}">${Array.from({ length: n }, (_, i) => ICONS[icon].replace('<svg ', `<svg style="--i:${i}" `)).join('')}</div>${key ? `<p class="picto-key">${esc(key)}</p>` : ''}`;
}

// ---------------------------------------------------------------------------
/** Claude's longest solo run against well-known durations. */
export function durationCompare(minutes, lang = 'en') {
  const fr = lang === 'fr';
  if (!(minutes >= 1)) return '';
  const refs = [
    { label: fr ? 'Un match de foot' : 'A football match', min: 90 },
    { label: 'Titanic', min: 194 },
    { label: fr ? 'Le Retour du roi (version longue)' : 'The Return of the King (extended)', min: 263 },
    { label: fr ? 'Claude, seul, sur une de tes demandes' : 'Claude, alone, on one of your requests', min: minutes, you: true },
  ].sort((a, b) => a.min - b.min);
  const max = Math.max(...refs.map((r) => r.min));
  const dur = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')}` : `${Math.round(m)} min`);
  return `<div class="compare">${refs
    .map((r) => `<div class="cmp-label${r.you ? ' you' : ''}">${esc(r.label)}</div><div class="cmp-row"><div class="cmp-bar${r.you ? ' you' : ''}" style="width:${Math.max(1, (r.min / max) * 82)}%"></div><span>${dur(r.min)}</span></div>`)
    .join('')}</div>`;
}

/** Two-part bar (file reads vs edits). */
export function splitBar(a, b, la, lb, lang = 'en') {
  if (!(a + b > 0)) return '';
  const pa = (a / (a + b)) * 100;
  return `<div class="split" role="img" aria-label="${esc(`${fmt(a, lang)} ${la}, ${fmt(b, lang)} ${lb}`)}">
  <div class="split-bar"><div style="width:${pa}%;background:var(--m-opus)" title="${fmt(a, lang)} ${esc(la)}"></div><div style="width:${100 - pa}%;background:var(--m-fable)" title="${fmt(b, lang)} ${esc(lb)}"></div></div>
  <div class="legend"><span><i style="background:var(--m-opus)"></i>${esc(la)} <b>${fmt(a, lang)}</b></span><span><i style="background:var(--m-fable)"></i>${esc(lb)} <b>${fmt(b, lang)}</b></span></div>
</div>`;
}

// ---------------------------------------------------------------------------
/** 100 pills colored by model family (largest remainder rounding). */
export function pillWaffle(mix, lang = 'en') {
  const pc = lang === 'fr' ? ' %' : '%';
  const fams = MODEL_FAMILIES.filter((f) => mix[f] > 0);
  const raw = fams.map((f) => ({ f, exact: mix[f] * 100 }));
  const base = raw.map((x) => ({ ...x, n: Math.floor(x.exact) }));
  let left = 100 - base.reduce((s, x) => s + x.n, 0);
  [...base].sort((x, y) => y.exact - y.n - (x.exact - x.n)).forEach((x) => { if (left > 0) { x.n++; left--; } });
  const name = (f) => f[0].toUpperCase() + f.slice(1);
  let k = 0;
  const pills = base.flatMap((x) => Array.from({ length: x.n }, () => `<i style="background:var(--m-${x.f});--i:${k++}" title="${esc(name(x.f))}"></i>`)).join('');
  const legend = fams.map((f) => `<span><i style="background:var(--m-${f})"></i>${name(f)} <b>${mix[f] < 0.01 ? '<1' : Math.round(mix[f] * 100)}${pc}</b></span>`).join('');
  return `<div class="pills" role="img" aria-label="${esc(fams.map((f) => `${name(f)} ${Math.round(mix[f] * 100)}%`).join(', '))}">${pills}</div><div class="legend">${legend}</div>`;
}

// ---------------------------------------------------------------------------
const SHORT_FR = { hours: 'Heures', streak: 'Série', presence: 'Présence', intensity: 'Intensité', marathon: 'Marathon', delegation: 'Délégation', output: 'Production', limits: 'Limites', opus: 'Opus' };
const SHORT = { hours: 'Hours', streak: 'Streak', presence: 'Presence', intensity: 'Intensity', marathon: 'Marathon', delegation: 'Delegation', output: 'Output', limits: 'Limits', opus: 'Opus' };

/** Symptom profile: share of each criterion's points earned. */
export function radar(criteria, lang = 'en') {
  const short = lang === 'fr' ? SHORT_FR : SHORT;
  const S = 420;
  const c = S / 2;
  const R = 130;
  const keys = Object.keys(CRITERIA);
  const byKey = Object.fromEntries(criteria.map((x) => [x.key, x]));
  const ang = (i) => -90 + (360 / keys.length) * i;
  const ring = (f) => keys.map((_, i) => pt(c, R * f, ang(i))).join(' ');
  const grid = [0.25, 0.5, 0.75, 1].map((f) => `<polygon points="${ring(f)}" class="grid-line"/>`).join('');
  const axes = keys.map((_, i) => `<line x1="${c}" y1="${c}" x2="${pt(c, R, ang(i)).split(',')[0]}" y2="${pt(c, R, ang(i)).split(',')[1]}" class="grid-line"/>`).join('');
  const vals = keys.map((k) => {
    const x = byKey[k];
    return x && x.earned !== null && x.points ? x.earned / x.points : null;
  });
  const shape = keys.map((_, i) => pt(c, R * Math.max(0.02, vals[i] || 0), ang(i))).join(' ');
  const dots = keys
    .map((k, i) => (vals[i] == null ? '' : `<circle cx="${pt(c, R * Math.max(0.02, vals[i]), ang(i)).split(',')[0]}" cy="${pt(c, R * Math.max(0.02, vals[i]), ang(i)).split(',')[1]}" r="5" class="dot"><title>${esc(CRITERIA[k])}: ${Math.round(vals[i] * 100)}% of its points</title></circle>`))
    .join('');
  const labels = keys
    .map((k, i) => {
      const [x, y] = pt(c, R + 26, ang(i)).split(',').map(Number);
      const anchor = Math.abs(x - c) < 8 ? 'middle' : x > c ? 'start' : 'end';
      const pct = vals[i] == null ? (lang === 'fr' ? 'n.d.' : 'n/a') : `${Math.round(vals[i] * 100)}${lang === 'fr' ? ' %' : '%'}`;
      return `<text x="${x}" y="${y}" text-anchor="${anchor}" class="axis-label">${short[k]}</text><text x="${x}" y="${y + 17}" text-anchor="${anchor}" class="axis-value">${pct}</text>`;
    })
    .join('');
  return `<svg class="radar" viewBox="0 0 ${S} ${S}" role="img" aria-label="Symptom profile: share of points earned per criterion">
  ${grid}${axes}<polygon points="${shape}" class="shape"/>${dots}${labels}
</svg>`;
}

// ---------------------------------------------------------------------------
/** ECG strip: one heartbeat per day of the window, height = prompts that day. */
export function ecg(daily, startDay, lang = 'en') {
  const W = 760;
  const H = 240;
  const pts = ecgPoints(daily, W, H).map(([x, y]) => `${r1(x)},${r1(y)}`).join(' ');
  const max = Math.max(1, ...daily);
  const peak = daily.indexOf(max);
  const px = ((peak + 0.48) / daily.length) * W;
  const start = Date.parse(`${startDay}T00:00:00Z`);
  const peakDay = new Date(start + peak * DAY_MS).toLocaleDateString(loc(lang), { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return `<svg class="ecg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(lang === 'fr' ? `Prompts par jour, un battement par jour. Pic : ${fmt(max, lang)} prompts le ${peakDay}.` : `Prompts per day, one heartbeat per day. Peak: ${fmt(max)} prompts on ${peakDay}.`)}">
  <defs><pattern id="ecg-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" class="ecg-grid"/></pattern></defs>
  <rect width="${W}" height="${H}" fill="url(#ecg-grid)"/>
  <polyline points="${pts}" class="ecg-line"/>
  <text x="${r1(Math.min(W - 70, Math.max(4, px - 30)))}" y="18" class="ecg-peak">▼ ${fmt(max, lang)}</text>
</svg>`;
}

/** The Claudoxine box: a white medicine box, the one physical object next to the monitor. */
export function medicineBox(r, lang = 'en') {
  const fr = lang === 'fr';
  const arch = (fr ? ARCHETYPES_FR : ARCHETYPES)[r.archetype];
  const stage = (fr ? STAGES_FR : STAGES)[r.stage];
  const bars = Array.from({ length: 34 }, (_, i) => `<i style="width:${1 + ((i * 7 + r.score) % 3)}px"></i>`).join('');
  const aria = fr ? `Claudoxine ${r.score} milligrammes, pour ${arch.name}, boîte de ${r.window.days} jours` : `Claudoxine ${r.score} milligrams, for ${arch.name}, box of ${r.window.days} days`;
  const small = fr
    ? `Stade ${r.stage} · ${stage.name} · Boîte de ${r.window.days} jours · Voie orale, par terminal`
    : `Stage ${r.stage} · ${stage.name} · Box of ${r.window.days} days · Oral, via terminal`;
  return `<div class="medbox" role="img" aria-label="${esc(aria)}">
  <div class="medbox-band"></div>
  <div class="medbox-body">
    <div class="medbox-lab">Claude Dependency Test · ${fr ? 'Sur ordonnance' : 'Rx only'}</div>
    <div class="medbox-name">Claudoxine<sup>®</sup></div>
    <div class="medbox-dose"><b>${r.score}</b><span>mg / 100</span></div>
    <div class="medbox-ind">${esc(arch.name)}<small>${esc(small)}</small></div>
    <div class="medbox-foot"><div class="medbox-bars">${bars}</div><span>⠉⠇⠁⠥⠙⠕⠭⠊⠝⠑</span></div>
  </div>
</div>`;
}
