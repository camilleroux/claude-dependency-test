// GET /r?s=73&st=4&a=streak-dependency&... : a card rebuilt entirely from its URL. Used when a report is
// not published (offline mode, or the share site was unreachable). Nothing is stored.
import { ARCHETYPES, ARCHETYPES_FR, STAGES, STAGES_FR, decodeCard, encodeCard } from '../public/card.js';
import { badgeBlock, detectLang, esc, footer, head, htmlResponse, installCtaHtml, shareButtonsHtml, withLang } from '../lib/layout.js';

export const config = { runtime: 'edge' };

export default function handler(request) {
  const url = new URL(request.url);
  const card = decodeCard(url.search);
  if (!card) return Response.redirect(`${url.origin}/`, 302);

  const lang = detectLang(request);
  const fr = lang === 'fr';
  const explicit = url.searchParams.has('lang');
  const query = encodeCard(card);
  const stage = (fr ? STAGES_FR : STAGES)[card.stage];
  const arch = fr ? { ...ARCHETYPES[card.archetype], ...ARCHETYPES_FR[card.archetype] } : ARCHETYPES[card.archetype];
  const title = fr
    ? `Stade ${card.stage} : ${stage.name} (${card.score}/100) · Claude Dependency Test`
    : `Stage ${card.stage}: ${stage.name} (${card.score}/100) · Claude Dependency Test`;
  const description = fr
    ? `Diagnostic : ${arch.name}. ${arch.tagline} À quel point es-tu accro à Claude ?`
    : `Diagnosis: ${arch.name}. ${arch.tagline} How addicted to Claude are you?`;
  const base = `${url.origin}/r?${query}`;
  const alternates = { en: base, fr: withLang(base, 'fr') };
  const canonical = fr ? alternates.fr : base;
  const badge = `[![Claude Dependency: Stage ${card.stage}](${url.origin}/badge?s=${card.score}&st=${card.stage})](${canonical})`;

  return htmlResponse(`${head({ title, description, image: `${url.origin}/og?${query}`, canonical, extraCss: 'header.result { padding: 20px 0 28px; }', lang, alternates })}
  <header class="result">
    <p class="kicker">${fr ? 'Résultats · développeur anonyme' : 'Lab results · anonymous developer'}</p>
    <h1>${fr ? 'Stade' : 'Stage'} ${card.stage}${fr ? ' :' : ':'} ${esc(stage.name)}</h1>
    <p class="lead" style="max-width:none">${card.score}/100 · ${esc(arch.name)} ${arch.emoji}</p>
  </header>
  <canvas id="card" class="card-canvas" width="1200" height="630" role="img" aria-label="${esc(title)}"></canvas>
  ${shareButtonsHtml('', lang)}
  ${installCtaHtml(lang)}
  ${badgeBlock(badge, lang)}
  ${footer('', lang)}
<script type="module">
import { decodeCard, encodeCard, shareText } from '/card.js';
import { bindCopyButtons, bindThemeToggle, mountCard, wireShare } from '/ui.js';
const $ = (id) => document.getElementById(id);
const card = decodeCard(location.search);
const url = location.origin + '/r?' + encodeCard(card);
const { exportPng } = mountCard($('card'), () => card, location.host);
wireShare({
  card, url, text: shareText(card, document.documentElement.lang), exportPng, status: $('status'),
  els: { save: $('save'), copyImg: $('copy-img'), copyLink: $('copy-link'), native: $('native'), x: $('x'), linkedin: $('linkedin'), bluesky: $('bluesky'), mastodon: $('mastodon') },
});
bindCopyButtons();
bindThemeToggle($('theme'));
</script>
</body>
</html>`, explicit
    ? { cache: 'public, max-age=3600, s-maxage=31536000, immutable' }
    : { cache: 'private, max-age=3600', vary: 'Accept-Language' });
}
