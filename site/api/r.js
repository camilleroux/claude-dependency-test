// GET /r?s=73&st=4&a=streak-dependency&... : a card rebuilt entirely from its URL. Used when a report is
// not published (offline mode, or the share site was unreachable). Nothing is stored.
import { ARCHETYPES, STAGES, decodeCard, encodeCard } from '../public/card.js';
import { badgeBlock, esc, footer, head, htmlResponse, installCta, shareButtons } from '../lib/layout.js';

export const config = { runtime: 'edge' };

export default function handler(request) {
  const url = new URL(request.url);
  const card = decodeCard(url.search);
  if (!card) return Response.redirect(`${url.origin}/`, 302);

  const query = encodeCard(card);
  const stage = STAGES[card.stage];
  const arch = ARCHETYPES[card.archetype];
  const title = `Stage ${card.stage}: ${stage.name} (${card.score}/100) · Claude Dependency Test`;
  const description = `Diagnosis: ${arch.name}. ${arch.tagline} How addicted to Claude are you?`;
  const canonical = `${url.origin}/r?${query}`;
  const badge = `[![Claude Dependency: Stage ${card.stage}](${url.origin}/badge?s=${card.score}&st=${card.stage})](${canonical})`;

  return htmlResponse(`${head({ title, description, image: `${url.origin}/og?${query}`, canonical, extraCss: 'header.result { padding: 20px 0 28px; }' })}
  <header class="result">
    <p class="kicker">Lab results · anonymous developer</p>
    <h1>Stage ${card.stage}: ${esc(stage.name)}</h1>
    <p class="lead" style="max-width:none">${card.score}/100 · ${esc(arch.name)} ${arch.emoji}</p>
  </header>
  <canvas id="card" class="card-canvas" width="1200" height="630" role="img" aria-label="${esc(title)}"></canvas>
  ${shareButtons}
  ${installCta}
  ${badgeBlock(badge)}
  ${footer()}
<script type="module">
import { decodeCard, encodeCard, shareText } from '/card.js';
import { bindCopyButtons, bindThemeToggle, mountCard, wireShare } from '/ui.js';
const $ = (id) => document.getElementById(id);
const card = decodeCard(location.search);
const url = location.origin + '/r?' + encodeCard(card);
const { exportPng } = mountCard($('card'), () => card, location.host);
wireShare({
  card, url, text: shareText(card), exportPng, status: $('status'),
  els: { save: $('save'), copyImg: $('copy-img'), copyLink: $('copy-link'), native: $('native'), x: $('x'), linkedin: $('linkedin'), bluesky: $('bluesky'), mastodon: $('mastodon') },
});
bindCopyButtons();
bindThemeToggle($('theme'));
</script>
</body>
</html>`, { cache: 'public, max-age=3600, s-maxage=31536000, immutable' });
}
