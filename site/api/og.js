// GET /og?<card params> : 1200×630 PNG preview used by link unfurls. Mirrors the canvas card.
import { ImageResponse } from '@vercel/og';
import { ARCHETYPES, MONITOR, STAGES, decodeCard, ecgPoints, headlines, readouts } from '../public/card.js';
import { DEMO_REPORT } from '../lib/demo.js';
import { AUTHOR } from '../public/site-config.js';
import { loadReport } from '../lib/store.js';

export const config = { runtime: 'edge' };

// Fonts are fetched once per instance from Google Fonts (pattern from Vercel's OG docs).
// If that fails, @vercel/og falls back to its bundled sans-serif font.
const fontCache = new Map();
async function googleFont(family, weight, italic = false) {
  const key = `${family}:${weight}:${italic}`;
  if (!fontCache.has(key)) {
    fontCache.set(key, (async () => {
      const spec = italic ? `ital,wght@1,${weight}` : `wght@${weight}`;
      const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:${spec}`)).text();
      const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
      if (!src) throw new Error('font not found');
      const res = await fetch(src[1]);
      if (!res.ok) throw new Error('font download failed');
      return { name: family, data: await res.arrayBuffer(), weight, style: italic ? 'italic' : 'normal' };
    })().catch(() => null));
  }
  return fontCache.get(key);
}

const h = (style, ...children) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: children.flat() } });
const t = (style, text) => ({ type: 'div', props: { style: { display: 'flex', ...style }, children: text } });

export function cardTree(card, siteLabel) {
  const c = MONITOR;
  const stage = STAGES[card.stage];
  const arch = ARCHETYPES[card.archetype];
  const D = 'VT323';
  const M = 'IBM Plex Mono';
  const alarm = arch.alarm || '● STABLE';
  const daily = card.ecg || Array.from({ length: 14 }, (_, i) => Math.round(30 + card.score * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)))));
  const pts = ecgPoints(daily, 720, 210).map(([x, y]) => `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join(' ');
  const glow = (color, r = 12) => `0 0 ${r}px ${color}`;
  const cells = readouts(card).slice(0, 4);
  const nameSize = arch.name.length > 26 ? 50 : 60;

  return h({ width: 1200, height: 630, background: '#010302', padding: 14 },
    h({ flex: 1, flexDirection: 'column', background: c.screen, border: `2px solid ${c.line}`, borderRadius: 26, padding: '26px 34px 22px', fontFamily: D, color: c.ph },
      // top bar
      h({ justifyContent: 'space-between', alignItems: 'center' },
        h({ alignItems: 'center' },
          h({ width: 18, height: 18, borderRadius: 9, background: c.red, marginRight: 12 }),
          t({ fontSize: 34, color: c.ph, textShadow: glow(c.ph) }, 'CLAUDE DEPENDENCY MONITOR')),
        h({ background: alarm.startsWith('▲') ? c.amber : c.ph, color: '#000', fontSize: 28, padding: '2px 14px', alignItems: 'center' },
          alarm.startsWith('▲')
            ? { type: 'svg', props: { width: 16, height: 14, viewBox: '0 0 16 14', style: { marginRight: 8 }, children: [{ type: 'polygon', props: { points: '8,0 16,14 0,14', fill: '#000' } }] } }
            : h({ width: 12, height: 12, borderRadius: 6, background: '#000', marginRight: 8 }),
          alarm.replace(/^[▲●]\s*/, ''))),
      t({ fontSize: 22, color: c.dim, marginTop: 2, paddingBottom: 10, borderBottom: `1px solid ${c.bezel}` }, `BED 04 · ANONYMOUS DEVELOPER${card.days ? ` · OBSERVED ${card.days} DAYS` : ''}`),
      // body
      h({ marginTop: 14 },
        h({ flexDirection: 'column', width: 740 },
          t({ fontSize: 22, color: c.dim }, card.ecg ? `II · PROMPTS TO CLAUDE PER DAY · ${card.ecg.length} D` : 'II · DEPENDENCY RHYTHM'),
          { type: 'svg', props: { width: 720, height: 210, viewBox: '0 0 720 210', style: { marginTop: 4 }, children: [
            { type: 'polyline', props: { points: pts, fill: 'none', stroke: c.ph, strokeWidth: 3, strokeLinejoin: 'round' } },
          ] } },
          t({ fontSize: 26, color: c.amber, marginTop: 8 }, `DX · ${arch.code}`),
          t({ fontSize: nameSize, color: c.ph, textShadow: glow(c.ph), lineHeight: 1 }, arch.name.toUpperCase()),
          t({ fontFamily: M, fontSize: 17, color: c.ink, marginTop: 6 }, arch.tagline)),
        h({ flexDirection: 'column', flex: 1, alignItems: 'flex-end', borderLeft: `1px solid ${c.bezel}`, paddingLeft: 20 },
          h({ justifyContent: 'space-between', width: '100%' }, t({ fontSize: 26, color: c.dim }, 'CLAUDE DEPENDENCY'), t({ fontSize: 26, color: c.dim }, '/100')),
          t({ fontSize: 250, lineHeight: 0.9, color: '#EFFFF5', textShadow: glow(c.ph, 24), marginTop: 10 }, String(card.score)),
          t({ fontSize: 34, color: c.stages[card.stage], textShadow: glow(c.stages[card.stage], 8), marginTop: 6 }, `STAGE ${card.stage} · ${stage.name.toUpperCase()}`))),
      // readouts
      h({ marginTop: 'auto', paddingTop: 10, borderTop: `1px solid ${c.bezel}` },
        ...cells.map((r) => h({ flexDirection: 'column', width: 283 },
          t({ fontSize: 20, color: c.dim }, r.label),
          t({ fontSize: 42, color: c[r.color], textShadow: glow(c[r.color], 8), lineHeight: 1 }, r.value)))),
      h({ justifyContent: 'space-between', marginTop: 6 },
        t({ fontSize: 20, color: c.dim }, `HOW ADDICTED TO CLAUDE ARE YOU?  ·  BY ${AUTHOR.cardCredit.toUpperCase()}`),
        t({ fontSize: 20, color: c.faint }, `NOT AN ACTUAL MEDICAL DIAGNOSIS · ${String(siteLabel).toUpperCase()}`))));
}

export default async function handler(request) {
  const url = new URL(request.url);
  // /og/:slug follows a published report (and its updates); /og?s=… encodes the card in the URL.
  const slug = url.searchParams.get('slug');
  const entry = slug === 'demo' ? { report: DEMO_REPORT } : slug ? await loadReport(slug) : null;
  const card = entry ? { ...entry.report.card, ecg: entry.report.daily, headlines: headlines(entry.report, 4) } : decodeCard(url.search) || { ...DEMO_REPORT.card, ecg: DEMO_REPORT.daily };
  const fonts = (await Promise.all([
    googleFont('VT323', 400),
    googleFont('IBM Plex Mono', 400),
])).filter(Boolean);
  return new ImageResponse(cardTree(card, url.host), {
    width: 1200,
    height: 630,
    fonts,
    headers: { 'cache-control': slug ? 'public, max-age=600, s-maxage=3600' : 'public, max-age=86400, s-maxage=31536000, immutable' },
  });
}
