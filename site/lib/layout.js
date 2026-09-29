// HTML shared by the server-rendered pages (/r and /case/:slug), in English or French.
import { AUTHOR, FOLLOW, INSTALL_COMMANDS } from '../public/site-config.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** JSON for a <script type="application/json"> block: "<" is escaped so nothing can close the tag. */
export const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

/**
 * Page language: ?lang=fr|en wins, then the browser's Accept-Language (first preference).
 * Link previews (X, LinkedIn, Slack bots) send no French preference, so they get English.
 */
export function detectLang(request) {
  const url = new URL(request.url);
  const q = url.searchParams.get('lang');
  if (q === 'fr' || q === 'en') return q;
  const prefs = (request.headers.get('accept-language') || '')
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';');
      const qv = params.find((p) => p.trim().startsWith('q='));
      return { tag, q: qv ? Number(qv.trim().slice(2)) || 0 : 1 };
    })
    .filter((p) => p.tag)
    .sort((a, b) => b.q - a.q);
  return prefs[0] && prefs[0].tag.startsWith('fr') ? 'fr' : 'en';
}

/** Same URL with ?lang= set, for the language switch and hreflang links. */
export function withLang(url, lang) {
  const u = new URL(url);
  u.searchParams.set('lang', lang);
  return u.toString();
}

const L = (lang, en, fr) => (lang === 'fr' ? fr : en);

export function head({ title, description, image, canonical, extraCss = '', indexable = false, lang = 'en', alternates = null }) {
  const other = lang === 'fr' ? 'en' : 'fr';
  const switchHref = alternates ? alternates[other] : null;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
${alternates ? `<link rel="alternate" hreflang="en" href="${esc(alternates.en)}">\n<link rel="alternate" hreflang="fr" href="${esc(alternates.fr)}">\n<link rel="alternate" hreflang="x-default" href="${esc(alternates.en)}">` : ''}
<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
<meta name="author" content="${esc(AUTHOR.name)}">
<link rel="author" href="${esc(AUTHOR.url)}">
<meta name="twitter:creator" content="@${esc(AUTHOR.via.x)}">
<meta name="twitter:site" content="@${esc(AUTHOR.via.x)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Claude Dependency Test">
<meta property="og:locale" content="${lang === 'fr' ? 'fr_FR' : 'en_US'}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💊</text></svg>">
<link rel="preload" href="/fonts/VT323-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/IBMPlexMono-400.woff2" as="font" type="font/woff2" crossorigin>
<meta name="theme-color" content="#010403">
<link rel="stylesheet" href="/site.css">
<script src="/va.js"></script>
<script defer src="/_vercel/insights/script.js"></script>
${extraCss ? `<style>${extraCss}</style>` : ''}
</head>
<body>
<div class="wrap">
  <nav>
    <a class="brand" href="${lang === 'fr' ? '/fr' : '/'}">CLAUDE DEPENDENCY TEST</a>
    <span class="nav-links"><span class="nav-meta">${L(lang, 'How addicted to Claude are you?', 'À quel point es-tu accro à Claude ?')}</span>${switchHref ? `<a class="btn lang-switch" href="${esc(switchHref)}" hreflang="${other}" lang="${other}">${other.toUpperCase()}</a>` : ''}</span>
  </nav>`;
}

/** Share buttons. `s` suffixes the ids so a page can show two sets (top and bottom). */
export const shareButtonsHtml = (s = '', lang = 'en') => `
  <div class="btn-row share-row" style="margin-top:18px">
    <a class="btn primary" id="x${s}" target="_blank" rel="noopener">${L(lang, 'Post on X', 'Publier sur X')}</a>
    <a class="btn primary" id="linkedin${s}" target="_blank" rel="noopener">LinkedIn</a>
    <a class="btn primary" id="bluesky${s}" target="_blank" rel="noopener">Bluesky</a>
    <a class="btn primary" id="mastodon${s}" target="_blank" rel="noopener">Mastodon</a>
    <button class="btn" id="native${s}" type="button" hidden>${L(lang, 'Share…', 'Partager…')}</button>
  </div>
  <div class="btn-row share-more">
    <button class="btn" id="copy-link${s}" type="button">${L(lang, 'Copy link', 'Copier le lien')}</button>
    <button class="btn" id="save${s}" type="button">${L(lang, 'Save as PNG', 'Enregistrer en PNG')}</button>
    <button class="btn" id="copy-img${s}" type="button">${L(lang, 'Copy image', "Copier l'image")}</button>
  </div>
  <div class="status" id="status${s}" role="status"></div>`;
export const shareButtons = shareButtonsHtml();

export const installCtaHtml = (lang = 'en') => `
  <section class="cta">
    <div>
      <p class="kicker">${L(lang, 'Your turn', 'À toi')}</p>
      <h2>${L(lang, "Think you're less addicted? Prove it.", 'Tu te crois moins accro ? Prouve-le.')}</h2>
      <p class="muted">${L(lang, 'Three commands in Claude Code. The score is computed on your machine. Your prompts, code and file names never leave it.', 'Trois commandes dans Claude Code. Le score est calculé sur ta machine. Tes prompts, ton code et tes noms de fichiers ne la quittent jamais.')}</p>
    </div>
    <div><div class="install">${INSTALL_COMMANDS.map(
      (cmd, i) => `<div class="cmd"><span class="n">${i + 1}</span><code>${esc(cmd)}</code><button class="btn" type="button" data-copy="${esc(cmd)}">${L(lang, 'Copy', 'Copier')}</button></div>`,
    ).join('')}</div>
      <p class="install-alt">${L(lang, 'Or from any terminal, no plugin needed:', "Ou depuis n'importe quel terminal, sans plugin :")}</p>
      <div class="install"><div class="cmd"><span class="n sh">$</span><code>npx claude-dependency-test</code><button class="btn" type="button" data-copy="npx claude-dependency-test">${L(lang, 'Copy', 'Copier')}</button></div></div></div>
  </section>`;
export const installCta = installCtaHtml();

export function badgeBlock(markdown, lang = 'en') {
  return `
  <section class="block" style="margin-top:36px">
    <p class="kicker">${L(lang, 'Wear it proudly', 'Porte-le fièrement')}</p>
    <h3>${L(lang, 'README badge', 'Badge pour ton README')}</h3>
    <pre class="snippet" id="badge">${esc(markdown)}</pre>
    <button class="btn" type="button" data-copy="${esc(markdown)}">${L(lang, 'Copy badge markdown', 'Copier le markdown du badge')}</button>
  </section>`;
}

export const followLinks = () =>
  FOLLOW.map((f) => `<a href="${esc(f.url)}" rel="noopener me" target="_blank">${esc(f.network)} ${esc(f.handle)}</a>`).join(' · ');

export const followBlock = (lang = 'en') =>
  FOLLOW.length ? `<p class="follow"><b>${L(lang, 'Follow the doctor', 'Suis le docteur')}</b> ${L(lang, 'for new symptoms and features:', 'pour les nouveaux symptômes et fonctionnalités :')} ${followLinks()}</p>` : '';

/** Plain, followed link to the author's site (the SEO credit). */
export const madeBy = (lang = 'en') =>
  `<p class="made-by">${L(lang, 'Made by', 'Créé par')} <a href="${esc(AUTHOR.url)}" rel="author">${esc(AUTHOR.name)}</a>. ${L(lang, 'More experiments and articles on', "D'autres expériences et articles sur")} <a href="${esc(AUTHOR.url)}">camilleroux.com</a>.</p>`;

export const footer = (extra = '', lang = 'en') => `
  <footer>${madeBy(lang)}${FOLLOW.length ? `<p class="follow-foot">${L(lang, 'Follow the doctor:', 'Suis le docteur :')} ${followLinks()}</p>` : ''}${L(lang, 'Not an actual medical diagnosis. Unofficial, not affiliated with Anthropic.', "Pas un vrai diagnostic médical. Non officiel, sans lien avec Anthropic.")} <a href="${lang === 'fr' ? '/fr#methodology' : '/#methodology'}">${L(lang, 'How the score works', 'Comment le score est calculé')}</a> · <a href="${lang === 'fr' ? '/fr/privacy' : '/privacy'}">${L(lang, 'Privacy', 'Confidentialité')}</a>${extra}</footer>
</div>`;

export function htmlResponse(html, { status = 200, cache = 'public, max-age=300, s-maxage=3600', vary = null } = {}) {
  const headers = { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache };
  if (vary) headers.vary = vary;
  return new Response(html, { status, headers });
}
