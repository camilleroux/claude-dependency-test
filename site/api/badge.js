// GET /badge?s=73&st=4 : shields-style SVG badge for GitHub READMEs. Only score and stage.
import { STAGES } from '../public/card.js';
import { loadReport } from '../lib/store.js';

export const config = { runtime: 'edge' };

const COLORS = { 1: '#5B8C5A', 2: '#A3A04B', 3: '#D29A3A', 4: '#C4553A', 5: '#8E2C48' };
// Approximate Verdana 11px advance widths, good enough for a badge.
const width = (s) => Math.round([...s].reduce((w, ch) => w + (/[ilI.,:·|!]/.test(ch) ? 3.5 : /[mwMW]/.test(ch) ? 9.5 : /[A-Z0-9]/.test(ch) ? 7.5 : 6.3), 0)) + 12;

export function badgeSvg(score, stage) {
  const left = 'claude dependency';
  const right = stage ? `stage ${stage} · ${score}/100` : 'take the test';
  const lw = width(left);
  const rw = width(right);
  const color = COLORS[stage] || '#6E685F';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lw + rw}" height="20" role="img" aria-label="${left}: ${right}">
<title>${left}: ${right}${stage ? ` (${STAGES[stage].name})` : ''}</title>
<linearGradient id="g" x2="0" y2="100%"><stop offset="0" stop-color="#bbb" stop-opacity=".1"/><stop offset="1" stop-opacity=".1"/></linearGradient>
<clipPath id="r"><rect width="${lw + rw}" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)"><rect width="${lw}" height="20" fill="#3A3733"/><rect x="${lw}" width="${rw}" height="20" fill="${color}"/><rect width="${lw + rw}" height="20" fill="url(#g)"/></g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" font-size="11">
<text x="${lw / 2}" y="15" fill="#010101" fill-opacity=".3">${left}</text><text x="${lw / 2}" y="14">${left}</text>
<text x="${lw + rw / 2}" y="15" fill="#010101" fill-opacity=".3">${right}</text><text x="${lw + rw / 2}" y="14">${right}</text>
</g></svg>`;
}

export default async function handler(request) {
  const q = new URL(request.url).searchParams;
  let s = null;
  let st = null;
  const slug = q.get('slug');
  if (slug) {
    // /badge/:slug always shows the latest published score.
    const entry = await loadReport(slug);
    if (entry) ({ score: s, stage: st } = entry.report);
  } else {
    s = /^\d{1,3}$/.test(q.get('s') || '') ? Number(q.get('s')) : null;
    st = /^[1-5]$/.test(q.get('st') || '') ? Number(q.get('st')) : null;
  }
  const ok = s !== null && s <= 100 && st !== null;
  return new Response(badgeSvg(ok ? s : 0, ok ? st : null), {
    headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': slug ? 'public, max-age=60, s-maxage=60' : 'public, max-age=86400, s-maxage=31536000' },
  });
}
