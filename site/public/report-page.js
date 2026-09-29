// Client side of /case/:slug: card, share buttons and charts. Everything is drawn from the
// aggregate report embedded in the page; nothing else is fetched.
import { headlines, shareText, topTools, weekdays } from './card.js';
import { bindCopyButtons, bindThemeToggle, mountCard, wireShare } from './ui.js';

const $ = (id) => document.getElementById(id);
bindThemeToggle($('theme'));
bindCopyButtons();

// ---------------------------------------------------------------------------
const SVG = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}, parent) => {
  const node = document.createElementNS(SVG, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (parent) parent.appendChild(node);
  return node;
};
const LANG = document.documentElement.lang === 'fr' ? 'fr' : 'en';
const T = (en, fr) => (LANG === 'fr' ? fr : en);
const WEEKDAYS = weekdays(LANG);
const fmt = (v) => Math.round(v).toLocaleString(LANG === 'fr' ? 'fr-FR' : 'en-US');
const niceMax = (max) => {
  if (max <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * step >= max) return m * step;
  return 10 * step;
};

const tip = document.createElement('div');
tip.className = 'tip';
tip.setAttribute('role', 'tooltip');
document.body.appendChild(tip);
function hover(target, text, mark) {
  target.addEventListener('pointerenter', () => { tip.textContent = text; tip.classList.add('on'); mark?.classList.add('hover'); });
  target.addEventListener('pointermove', (e) => { tip.style.left = `${e.clientX}px`; tip.style.top = `${e.clientY}px`; });
  target.addEventListener('pointerleave', () => { tip.classList.remove('on'); mark?.classList.remove('hover'); });
}

function dataTable(container, headers, rows) {
  const d = document.createElement('details');
  d.className = 'data-table';
  d.innerHTML = `<summary>${T('Data table', 'Tableau des données')}</summary><div class="table-wrap"><table><thead><tr></tr></thead><tbody></tbody></table></div>`;
  for (const h of headers) d.querySelector('thead tr').appendChild(Object.assign(document.createElement('th'), { textContent: h }));
  for (const row of rows) {
    const tr = document.createElement('tr');
    row.forEach((v, i) => tr.appendChild(Object.assign(document.createElement('td'), { textContent: v, className: i ? 'num' : '' })));
    d.querySelector('tbody').appendChild(tr);
  }
  container.appendChild(d);
}

/** Single-series column chart: 4px rounded caps, square at the baseline, hairline grid. */
function columns(container, { values, labels, tickLabel, highlight, tooltip, height = 200 }) {
  const draw = () => {
    container.querySelector('svg')?.remove();
    const W = container.clientWidth || 600;
    const pad = { t: 10, r: 4, b: 26, l: 36 };
    const iw = W - pad.l - pad.r;
    const ih = height - pad.t - pad.b;
    const max = niceMax(Math.max(...values));
    const svg = el('svg', { width: W, height, role: 'img', 'aria-label': container.dataset.label || '' });
    for (const f of [0, 0.5, 1]) {
      const y = pad.t + ih - f * ih;
      el('line', { class: 'grid', x1: pad.l, x2: W - pad.r, y1: y, y2: y }, svg);
      el('text', { x: pad.l - 6, y: y + 4, 'text-anchor': 'end' }, svg).textContent = fmt(max * f);
    }
    const band = iw / values.length;
    const bw = Math.max(2, Math.min(24, band - 2));
    values.forEach((v, i) => {
      const h = (v / max) * ih;
      const x = pad.l + i * band + (band - bw) / 2;
      const y = pad.t + ih - h;
      const r = Math.min(4, h, bw / 2);
      const d = h <= 0 ? '' : `M${x},${pad.t + ih} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${pad.t + ih} Z`;
      const hit = el('rect', { class: 'hit', x: pad.l + i * band, y: pad.t, width: band, height: ih }, svg);
      const mark = el('path', { class: 'mark', d, fill: highlight(i) ? 'var(--accent)' : 'var(--bar)' }, svg);
      hover(hit, tooltip(i), mark);
      const label = tickLabel(i);
      if (label) el('text', { x: pad.l + i * band + band / 2, y: height - 8, 'text-anchor': 'middle' }, svg).textContent = label;
    });
    container.prepend(svg);
  };
  draw();
  new ResizeObserver(draw).observe(container);
}

function renderCharts(r) {
  if ($('chart-weekdays')) weekly($('chart-weekdays'), r);
  if ($('chart-tools')) toolbox($('chart-tools'), r.usage);
}

/** Weekly pattern, Monday first; weekends highlighted. */
function weekly(container, r) {
  const order = [1, 2, 3, 4, 5, 6, 0];
  container.dataset.label = T(`Prompts by weekday. Busiest: ${WEEKDAYS[r.extras.peakWeekday]}.`, `Prompts par jour de la semaine. Jour le plus chargé : ${WEEKDAYS[r.extras.peakWeekday]}.`);
  columns(container, {
    values: order.map((d) => r.weekdays[d]),
    highlight: (i) => order[i] === 0 || order[i] === 6,
    tickLabel: (i) => WEEKDAYS[order[i]].slice(0, 3),
    tooltip: (i) => `${WEEKDAYS[order[i]]} · ${fmt(r.weekdays[order[i]])} prompts`,
    height: 180,
  });
  dataTable(container, [T('Day', 'Jour'), 'Prompts'], order.map((d) => [WEEKDAYS[d], fmt(r.weekdays[d])]));
}

/** Horizontal bars, one series: label left, value at the tip. */
function toolbox(container, usage) {
  const rows = topTools(usage, 8);
  if (!rows.length) {
    container.textContent = T('No tool calls recorded.', "Aucun appel d'outil enregistré.");
    return;
  }
  const label = LANG === 'fr' ? { mcp: 'Outils MCP', other: 'Autres outils', Agent: 'Agent (sous-agents)' } : { mcp: 'MCP tools', other: 'Other tools', Agent: 'Agent (subagents)' };
  const max = rows[0][1];
  const grid = document.createElement('div');
  grid.className = 'bars';
  for (const [name, n] of rows) {
    const l = document.createElement('div');
    l.textContent = label[name] || name;
    const row = document.createElement('div');
    row.className = 'row';
    const bar = document.createElement('div');
    bar.className = 'bar';
    bar.style.width = `${Math.max(0.5, (n / max) * 85)}%`;
    const v = document.createElement('span');
    v.className = 'val';
    v.textContent = fmt(n);
    row.append(bar, v);
    hover(row, `${label[name] || name} · ${fmt(n)} ${T('calls', 'appels')}`, bar);
    grid.append(l, row);
  }
  container.appendChild(grid);
}

// ---------------------------------------------------------------------------
// Boot (last, so every helper above is initialized).
const dataEl = $('report-data');
if (dataEl) {
  const { report: r, url } = JSON.parse(dataEl.textContent);
  const heads = headlines(r, 4); // the card image stays in English: it travels beyond this reader
  const { exportPng } = mountCard($('card'), () => ({ ...r.card, ecg: r.daily, headlines: heads }), location.host);
  for (const s of ['', '-2']) {
    if (!$(`save${s}`)) continue;
    const id = (k) => $(`${k}${s}`);
    wireShare({
      card: r.card, url, text: shareText(r.card, LANG), exportPng, status: id('status'),
      els: { save: id('save'), copyImg: id('copy-img'), copyLink: id('copy-link'), native: id('native'), x: id('x'), linkedin: id('linkedin'), bluesky: id('bluesky'), mastodon: id('mastodon') },
    });
  }
  renderCharts(r);
}

// ---------------------------------------------------------------------------
// Motion: reveal on scroll and a count-up score. Skipped entirely with reduced motion, and the
// page is complete without it (the "anim" class is only added here).
if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('anim');
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      io.unobserve(e.target);
    }
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  const counter = document.querySelector('[data-count]');
  if (counter) {
    const target = Number(counter.dataset.count);
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / 1300);
      counter.textContent = String(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    counter.textContent = '0';
    requestAnimationFrame(tick);
  }
}
