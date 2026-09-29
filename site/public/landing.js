// Landing page (/ and /fr): install block, rotating demo card, stages, conditions and scoring table.
// The page language comes from <html lang>; the demo card image stays in English on purpose.
import { ARCHETYPES, ARCHETYPES_FR, CRITERIA_FR, STAGES, STAGES_FR } from '/card.js';
import { bindCopyButtons, mountCard, renderInstall } from '/ui.js';
import { FOLLOW, REPO } from '/site-config.js';

const fr = document.documentElement.lang === 'fr';
const T = (en, frText) => (fr ? frText : en);
const $ = (id) => document.getElementById(id);

// Remember an explicit language choice so the French redirect never fights it.
for (const a of document.querySelectorAll('[data-set-lang]')) {
  a.addEventListener('click', () => { try { localStorage.setItem('cdt-lang', a.dataset.setLang); } catch {} });
}

$('follow-buttons').replaceChildren(...FOLLOW.map((f) =>
  Object.assign(document.createElement('a'), { className: 'btn', href: f.url, textContent: `${f.network} ${f.handle}`, rel: 'me noopener', target: '_blank' })));
$('follow').replaceChildren(...FOLLOW.flatMap((f, i) => {
  const a = Object.assign(document.createElement('a'), { href: f.url, textContent: `${f.network} ${f.handle}`, rel: 'noopener me', target: '_blank' });
  return i ? [document.createTextNode(' · '), a] : [a];
}));

$('gh').href = `https://github.com/${REPO}`;
renderInstall($('install'));
bindCopyButtons();

const archName = (slug) => (fr ? ARCHETYPES_FR[slug].name : ARCHETYPES[slug].name);
const series = (seed, base) => Array.from({ length: 30 }, (_, i) => ((i * seed) % 11 === 3 ? 0 : Math.round(base * (0.35 + ((i * seed * 7) % 13) / 13))));
const demos = [
  { score: 73, stage: 4, archetype: 'hypergraphia', days: 30, ecg: series(3, 90), headlines: [{ label: 'WORDS WRITTEN BY CLAUDE', value: '7.4M', color: 'cyan' }, { label: 'SUBAGENTS LAUNCHED', value: '96', color: 'amber' }, { label: 'LONGEST RUN WITHOUT YOU', value: '2 H 22', color: 'amber' }, { label: 'LONGEST SESSION', value: '6.4 H', color: 'magenta' }], sym: { h: 5.2, ad: 87, sk: 12, p: 64, o: 71 } },
  { score: 91, stage: 5, archetype: 'streak-dependency', days: 30, ecg: series(5, 140), sym: { h: 7.4, ad: 100, sk: 30, p: 112, w: 31, l: 6 } },
  { score: 47, stage: 3, archetype: 'middle-manager', days: 30, ecg: series(7, 60), sym: { h: 3.1, ad: 53, sk: 4, sa: 140, o: 38 } },
  { score: 16, stage: 1, archetype: 'recreational-use', days: 30, ecg: series(4, 20), sym: { h: 0.8, ad: 20, sk: 2, p: 7, o: 12 } },
];
let i = 0;
const name = $('demo-name');
const { redraw } = mountCard($('demo'), () => demos[i], location.host);
const show = () => { name.textContent = `${archName(demos[i].archetype)} · ${demos[i].score}/100`; };
show();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  setInterval(() => { i = (i + 1) % demos.length; show(); redraw(); }, 4000);
}

const stages = fr ? STAGES_FR : STAGES;
const colors = ['--s1', '--s2', '--s3', '--s4', '--s5'];
const ranges = ['0-20', '21-40', '41-60', '61-80', '81-100'];
$('stages').replaceChildren(...[1, 2, 3, 4, 5].map((n) => {
  const d = document.createElement('div');
  d.className = 'stage';
  d.style.setProperty('--c', `var(${colors[n - 1]})`);
  d.innerHTML = `<b>${T('STAGE', 'STADE')} ${n} · ${ranges[n - 1]}</b><strong></strong><span></span>`;
  d.querySelector('strong').textContent = stages[n].name;
  d.querySelector('span').textContent = stages[n].prognosis;
  return d;
}));

const trigger = fr
  ? { 'deep-focus': 'Heures actives', 'streak-dependency': 'Régularité', 'session-overextension': 'Sessions marathon', 'middle-manager': 'Délégation', 'hypergraphia': 'Production',
    'prompt-hyperactivity': 'Prompts par jour', 'limit-collision': "Limites d'usage", 'opus-affluenza': "Part d'Opus", 'recreational-use': 'Aucun symptôme grave' }
  : { 'deep-focus': 'Active hours', 'streak-dependency': 'Regularity', 'session-overextension': 'Marathon sessions', 'middle-manager': 'Delegation', 'hypergraphia': 'Output',
    'prompt-hyperactivity': 'Prompts per day', 'limit-collision': 'Usage limits', 'opus-affluenza': 'Opus share', 'recreational-use': 'No severe symptom' };
$('archetypes').replaceChildren(...Object.entries(ARCHETYPES).map(([slug, en]) => {
  const a = fr ? { ...en, ...ARCHETYPES_FR[slug] } : en;
  const t = document.createElement('div');
  t.className = 'tile';
  t.innerHTML = '<div class="emoji"></div><p class="kicker" style="margin:0 0 4px"></p><h3></h3><p class="muted small" style="margin:0"></p><span class="tag"></span>';
  t.querySelector('.emoji').textContent = a.emoji;
  t.querySelector('.kicker').textContent = a.code;
  t.querySelector('h3').textContent = a.name;
  t.querySelector('p.muted').textContent = a.tagline;
  t.querySelector('.tag').textContent = trigger[slug];
  return t;
}));

const num = (v) => (fr ? String(v).replace('.', ',') : String(v));
const fmt = (metric, v) => {
  if (/Share$/.test(metric)) return T(`${Math.round(v * 100)}%`, `${Math.round(v * 100)} %`);
  if (metric === 'activeHoursPerActiveDay') return T(`${v} h/day`, `${num(v)} h/jour`);
  if (metric === 'longestStreakDays') return T(`${v}-day streak`, `série de ${v} jours`);
  if (metric === 'limitHitsPer30Days') return T(`${v} / 30 days`, `${v} / 30 jours`);
  if (metric === 'promptsPerActiveDay') return T(`${v} prompts/day`, `${v} prompts/jour`);
  if (metric === 'longestSessionHours') return T(`${v} h session`, `session de ${num(v)} h`);
  if (metric === 'subagentsPerActiveDay') return T(`${v} subagents/day`, `${v} sous-agents/jour`);
  if (metric === 'wordsPerActiveDay') return T(`${v >= 1000 ? `${Math.round(v / 1000)}K` : v} words/day`, `${v >= 1000 ? `${Math.round(v / 1000)} k` : v} mots/jour`);
  return String(v);
};
const partLabel = fr ? { activeDaysShare: 'Jours actifs', longestStreakDays: 'Plus longue série' } : { activeDaysShare: 'Active days', longestStreakDays: 'Longest streak' };
fetch('/scoring.json').then((r) => r.json()).then((cfg) => {
  const rows = [];
  const row = (cells) => {
    const tr = document.createElement('tr');
    cells.forEach((v, k) => { const td = document.createElement('td'); td.textContent = v; if (k) td.className = 'num'; tr.appendChild(td); });
    rows.push(tr);
  };
  for (const [key, c] of Object.entries(cfg.criteria)) {
    const label = fr ? CRITERIA_FR[key] || c.label : c.label;
    if (c.parts.length === 1) row([label, String(c.points), fmt(c.parts[0].metric, c.parts[0].from), fmt(c.parts[0].metric, c.parts[0].to)]);
    else {
      row([label, String(c.points), '', '']);
      for (const p of c.parts) row([`  ↳ ${partLabel[p.metric] || p.metric} (${Math.round(p.weight * 100)}${T('%', ' %')})`, '', fmt(p.metric, p.from), fmt(p.metric, p.to)]);
    }
  }
  $('scoring').replaceChildren(...rows);
});
