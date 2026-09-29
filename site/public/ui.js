// Browser helpers shared by the landing page and result pages.
import { renderCardToCanvas, shareIntents } from './card.js';
import { AUTHOR, INSTALL_COMMANDS } from './site-config.js';

const media = window.matchMedia('(prefers-color-scheme: dark)');
let forced = null;
try { forced = localStorage.getItem('cdt-theme'); } catch {}
const listeners = [];

export const currentTheme = () => forced || (media.matches ? 'dark' : 'light');
export function onThemeChange(fn) { listeners.push(fn); fn(currentTheme()); }
function applyTheme() {
  if (forced) document.documentElement.dataset.theme = forced;
  else delete document.documentElement.dataset.theme;
  for (const fn of listeners) fn(currentTheme());
}
media.addEventListener('change', applyTheme);
export function bindThemeToggle(button) {
  if (!button) return; // the monitor is dark only; kept for older pages
  button.addEventListener('click', () => {
    forced = currentTheme() === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('cdt-theme', forced); } catch {}
    applyTheme();
  });
  applyTheme();
}

const FR = () => document.documentElement.lang === 'fr';
const T = (en, fr) => (FR() ? fr : en);

async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function renderInstall(container) {
  container.replaceChildren();
  INSTALL_COMMANDS.forEach((cmd, i) => {
    const row = document.createElement('div');
    row.className = 'cmd';
    const n = document.createElement('span');
    n.className = 'n';
    n.textContent = String(i + 1);
    const code = document.createElement('code');
    code.textContent = cmd;
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.type = 'button';
    btn.textContent = T('Copy', 'Copier');
    btn.addEventListener('click', async () => {
      btn.textContent = (await copy(cmd)) ? T('Copied', 'Copié') : T('Select & copy', 'Sélectionne et copie');
      setTimeout(() => { btn.textContent = T('Copy', 'Copier'); }, 1500);
    });
    row.append(n, code, btn);
    container.appendChild(row);
  });
}

/** Monitor card on a canvas, redrawn once the pixel fonts are loaded. `exportPng` renders 1200×630. */
export const fontsReady = () =>
  document.fonts ? Promise.all([document.fonts.load('40px VT323'), document.fonts.load('16px "IBM Plex Mono"')]).catch(() => {}) : Promise.resolve();

export function mountCard(canvas, getCard, siteLabel) {
  const redraw = () => renderCardToCanvas(canvas, getCard(), { siteLabel, credit: AUTHOR.cardCredit, scale: 2 });
  redraw();
  fontsReady().then(redraw);
  const exportPng = () => new Promise((resolve) => {
    renderCardToCanvas(document.createElement('canvas'), getCard(), { siteLabel, credit: AUTHOR.cardCredit, scale: 1 }).toBlob(resolve, 'image/png');
  });
  return { redraw, exportPng };
}

export function wireShare({ card, url, text, exportPng, els, status }) {
  const say = (m) => { if (status) status.textContent = m; };
  const intents = shareIntents(url, text, AUTHOR.via);
  for (const k of ['x', 'linkedin', 'bluesky', 'mastodon']) if (els[k]) els[k].href = intents[k];
  els.save?.addEventListener('click', async () => {
    const blob = await exportPng();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `claude-dependency-${card.score}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    say(T('Saved a 1200×630 PNG, rendered in your browser.', 'PNG 1200×630 enregistré, généré dans ton navigateur.'));
  });
  els.copyImg?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportPng() })]);
      say(T('Image copied. Paste it anywhere.', 'Image copiée. Colle-la où tu veux.'));
    } catch { say(T('Your browser blocked image copy. Use "Save as PNG" instead.', "Ton navigateur bloque la copie d'image. Utilise « Enregistrer en PNG ».")); }
  });
  els.copyLink?.addEventListener('click', async () => say((await copy(url)) ? T('Link copied.', 'Lien copié.') : url));
  if (els.native) {
    if (navigator.share) {
      els.native.hidden = false;
      els.native.addEventListener('click', async () => {
        try {
          const blob = await exportPng();
          const file = new File([blob], `claude-dependency-${card.score}.png`, { type: 'image/png' });
          const data = navigator.canShare?.({ files: [file] }) ? { files: [file], text: `${text}\n${url}` } : { text, url };
          await navigator.share(data);
        } catch { /* dismissed */ }
      });
    } else els.native.hidden = true;
  }
}

/** Any element with data-copy="text" copies that text when clicked. */
export function bindCopyButtons(root = document) {
  for (const btn of root.querySelectorAll('[data-copy]')) {
    const label = btn.textContent;
    btn.addEventListener('click', async () => {
      btn.textContent = (await copy(btn.dataset.copy)) ? T('Copied', 'Copié') : T('Select & copy', 'Sélectionne et copie');
      setTimeout(() => { btn.textContent = label; }, 1500);
    });
  }
}
