// HTML shared by the server-rendered pages (/r and /case/:slug).
import { AUTHOR, FOLLOW, INSTALL_COMMANDS } from '../public/site-config.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** JSON for a <script type="application/json"> block: "<" is escaped so nothing can close the tag. */
export const safeJson = (v) => JSON.stringify(v).replace(/</g, '\\u003c');

export function head({ title, description, image, canonical, extraCss = '', indexable = false }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta name="robots" content="${indexable ? 'index, follow' : 'noindex, follow'}">
<meta name="author" content="${esc(AUTHOR.name)}">
<link rel="author" href="${esc(AUTHOR.url)}">
<meta name="twitter:creator" content="@${esc(AUTHOR.via.x)}">
<meta name="twitter:site" content="@${esc(AUTHOR.via.x)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Claude Dependency Test">
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
    <a class="brand" href="/">CLAUDE DEPENDENCY TEST</a>
    <span class="nav-meta">How addicted to Claude are you?</span>
  </nav>`;
}

/** Share buttons. `s` suffixes the ids so a page can show two sets (top and bottom). */
export const shareButtonsHtml = (s = '') => `
  <div class="btn-row share-row" style="margin-top:18px">
    <a class="btn primary" id="x${s}" target="_blank" rel="noopener">Post on X</a>
    <a class="btn primary" id="linkedin${s}" target="_blank" rel="noopener">LinkedIn</a>
    <a class="btn primary" id="bluesky${s}" target="_blank" rel="noopener">Bluesky</a>
    <a class="btn primary" id="mastodon${s}" target="_blank" rel="noopener">Mastodon</a>
    <button class="btn" id="native${s}" type="button" hidden>Share…</button>
  </div>
  <div class="btn-row share-more">
    <button class="btn" id="copy-link${s}" type="button">Copy link</button>
    <button class="btn" id="save${s}" type="button">Save as PNG</button>
    <button class="btn" id="copy-img${s}" type="button">Copy image</button>
  </div>
  <div class="status" id="status${s}" role="status"></div>`;
export const shareButtons = shareButtonsHtml();

export const installCta = `
  <section class="cta">
    <div>
      <p class="kicker">Your turn</p>
      <h2>Think you're less addicted? Prove it.</h2>
      <p class="muted">Three commands in Claude Code. The score is computed on your machine. Your prompts, code and file names never leave it.</p>
    </div>
    <div class="install">${INSTALL_COMMANDS.map(
      (cmd, i) => `<div class="cmd"><span class="n">${i + 1}</span><code>${esc(cmd)}</code><button class="btn" type="button" data-copy="${esc(cmd)}">Copy</button></div>`,
    ).join('')}</div>
  </section>`;

export function badgeBlock(markdown) {
  return `
  <section class="block" style="margin-top:36px">
    <p class="kicker">Wear it proudly</p>
    <h3>README badge</h3>
    <pre class="snippet" id="badge">${esc(markdown)}</pre>
    <button class="btn" type="button" data-copy="${esc(markdown)}">Copy badge markdown</button>
  </section>`;
}

export const followLinks = () =>
  FOLLOW.map((f) => `<a href="${esc(f.url)}" rel="noopener me" target="_blank">${esc(f.network)} ${esc(f.handle)}</a>`).join(' · ');

export const followBlock = () =>
  FOLLOW.length ? `<p class="follow"><b>Follow the doctor</b> for new symptoms and features: ${followLinks()}</p>` : '';

/** Plain, followed link to the author's site (the SEO credit). */
export const madeBy = () => `<p class="made-by">Made by <a href="${esc(AUTHOR.url)}" rel="author">${esc(AUTHOR.name)}</a>. More experiments and articles on <a href="${esc(AUTHOR.url)}">camilleroux.com</a>.</p>`;

export const footer = (extra = '') => `
  <footer>${madeBy()}${FOLLOW.length ? `<p class="follow-foot">Follow the doctor: ${followLinks()}</p>` : ''}Not an actual medical diagnosis. Unofficial, not affiliated with Anthropic. <a href="/#methodology">How the score works</a> · <a href="/privacy">Privacy</a>${extra}</footer>
</div>`;

export function htmlResponse(html, { status = 200, cache = 'public, max-age=300, s-maxage=3600' } = {}) {
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache } });
}
