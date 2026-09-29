// GET /case/:slug : the online lab report for a published diagnosis (the patient's case file).
import {
  ARCHETYPES,
  CRITERIA,
  METRICS,
  STAGES,
  WAR_AND_PEACE_WORDS,
  WEEKDAYS,
  WORDS_PER_TOKEN,
  compact,
  formatHour,
  formatMinuteOfDay,
  headlines,
  severityFlag,
  usageFacts,
} from '../public/card.js';
import { doctorNotes, prescription, sideEffects, typingTime } from '../lib/notes.js';
import { attendance, dayStrip, durationCompare, ecg, medicineBox, pictogram, pillWaffle, radar, radialClock, splitBar, stageScale } from '../lib/infographics.js';
import { DEMO_REPORT } from '../lib/demo.js';
import { loadReport } from '../lib/store.js';
import { badgeBlock, esc, followBlock, footer, head, htmlResponse, installCta, safeJson, shareButtons, shareButtonsHtml } from '../lib/layout.js';

export const config = { runtime: 'edge' };

const n = (v) => Math.round(v).toLocaleString('en-US');
const fmtDay = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function symptomRows(r) {
  const rows = [];
  for (const c of r.criteria) {
    const label = CRITERIA[c.key];
    if (c.earned === null) {
      rows.push(`<tr class="na"><td>${esc(label)}</td><td colspan="3" class="muted">Not assessed: not measurable from this data. The score was renormalized.</td><td class="num">–/${c.points}</td></tr>`);
      continue;
    }
    const ratio = c.points ? c.earned / c.points : 0;
    c.parts.forEach((p, i) => {
      const f = METRICS[p.metric];
      const meter = i === 0
        ? `<span class="meter" role="img" aria-label="${esc(`${c.earned.toFixed(1)} of ${c.points} points`)}"><span style="width:${Math.round(ratio * 100)}%"></span></span>`
        : '';
      rows.push(`<tr${i ? ' class="sub"' : ''}><td>${esc(i ? `↳ ${f.label}` : c.parts.length > 1 ? `${label}: ${f.label.toLowerCase()}` : label)}</td>`
        + `<td class="num">${esc(f.value(p.value))}</td><td class="num muted">${esc(f.ref(p.from, p.to))}</td>`
        + `<td>${meter}${i === 0 && severityFlag(ratio) ? ` <span class="flag">${severityFlag(ratio)}</span>` : ''}</td>`
        + `<td class="num">${i === 0 ? `${c.earned.toFixed(1)}/${c.points}` : ''}</td></tr>`);
    });
  }
  return rows.join('');
}

const CSS = `
  /* ---- Hero: the bedside monitor ---- */
  .monitor { margin: 26px 0 8px; background: var(--screen); border: 1px solid var(--line-2); border-radius: 22px; padding: 18px 24px 22px;
    box-shadow: 0 0 0 10px #050b08, 0 0 0 11px var(--line), inset 0 0 90px rgba(59, 255, 140, .07), 0 40px 90px -40px rgba(59, 255, 140, .3); position: relative; }
  .mon-bar { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 8px 16px; padding-bottom: 12px; border-bottom: 1px solid var(--line); font: 400 20px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--muted); }
  .mon-bar .rec { color: var(--ph); font-size: 26px; text-shadow: var(--glow); }
  .mon-bar .rec::before { content: '● '; color: var(--red); }
  .alarm { background: var(--amber); color: #000; padding: 4px 10px 3px; font: 400 22px/1 var(--display); letter-spacing: .06em; }
  .alarm.ok { background: var(--ph); }
  .mon-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 0 26px; padding-top: 14px; }
  @media (max-width: 820px) { .mon-grid { grid-template-columns: minmax(0, 1fr); } }
  .lbl { font: 400 20px/1.1 var(--display); letter-spacing: .08em; text-transform: uppercase; color: var(--muted); display: flex; justify-content: space-between; gap: 10px; }
  .lbl.amber { color: var(--amber); } .lbl.cyan { color: var(--cyan); }
  .ecg { width: 100%; height: 240px; display: block; margin-top: 6px; }
  .ecg-grid { stroke: var(--track); stroke-width: 1; }
  .ecg-line { fill: none; stroke: var(--ph); stroke-width: 2.4; stroke-linejoin: round; filter: drop-shadow(0 0 4px var(--ph)); vector-effect: non-scaling-stroke; }
  .ecg-peak { fill: var(--amber); font: 400 18px var(--display); }
  .mon-score { border-left: 1px solid var(--line); padding-left: 24px; display: flex; flex-direction: column; }
  @media (max-width: 820px) { .mon-score { border-left: 0; padding-left: 0; border-top: 1px solid var(--line); padding-top: 12px; margin-top: 10px; } }
  .mon-score b { font: 400 clamp(170px, 26vw, 260px)/.8 var(--display); color: #EFFFF5; text-align: right; text-shadow: 0 0 14px rgba(59, 255, 140, .8), 0 0 50px rgba(59, 255, 140, .35); margin-top: 18px; }
  .mon-score .stg { text-transform: uppercase; font: 400 30px/1 var(--display); text-align: right; letter-spacing: .04em; margin-top: 10px; text-shadow: 0 0 10px currentColor; }
  .mon-dx { padding: 18px 0 16px; border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin-top: 16px; }
  .mon-dx h1 { font-size: clamp(40px, 6.4vw, 76px); margin: 6px 0 8px; }
  .mon-dx p { margin: 0; color: var(--ink); max-width: 60ch; }
  .mon-read { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0 14px; }
  .mon-read > div { padding: 12px 0 0; display: grid; grid-template-rows: 2.3em auto auto; align-content: start; gap: 4px; }
  .mon-read b { display: block; font: 400 46px/1 var(--display); text-shadow: 0 0 10px currentColor; }
  .mon-read small { display: block; font-size: 12px; line-height: 1.35; color: var(--muted); max-width: 22ch; }
  .mon-read .lbl { align-items: flex-end; line-height: 1.1; }
  .mon-read-title { font: 400 18px/1 var(--display); letter-spacing: .1em; color: var(--muted); text-transform: uppercase; padding-top: 14px; }
  .ecg-legend { font-size: 12px; color: var(--muted); margin: 4px 0 0; }
  .scale { margin: 18px 0 4px; }
  .scale-bar { position: relative; display: flex; gap: 4px; }
  .scale-seg { flex: 1; height: 12px; background: color-mix(in oklab, var(--c) 18%, var(--screen)); border: 1px solid color-mix(in oklab, var(--c) 40%, transparent); }
  .scale-seg.on { background: var(--c); box-shadow: 0 0 12px var(--c); }
  .scale-marker { position: absolute; top: -8px; width: 3px; height: 28px; margin-left: -1.5px; background: #fff; box-shadow: 0 0 8px #fff; }
  .scale-labels { display: flex; gap: 4px; margin-top: 8px; }
  .scale-labels span { flex: 1; font: 400 17px/1 var(--display); letter-spacing: .06em; text-transform: uppercase; color: var(--faint); }
  .scale-labels span.on { color: var(--ink); }
  .hero-actions { display: flex; flex-direction: column; align-items: center; gap: 4px; margin: 22px 0 0; text-align: center; }
  .hero-actions .btn-row { justify-content: center; }
  .scroll-hint { margin-top: 26px; font: 400 20px/1 var(--display); letter-spacing: .1em; color: var(--muted); text-decoration: none; }
  html.anim .alarm:not(.ok) { animation: alarm 1.2s steps(1) infinite; }
  @keyframes alarm { 50% { opacity: .35; } }

  /* ---- Chapters: one screen each ---- */
  .column { max-width: 860px; margin: 0 auto; }
  .chapter { padding: 64px 0 20px; }
  .chapter-head { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px solid var(--line-2); padding-bottom: 8px; margin-bottom: 18px; font: 400 20px/1 var(--display); letter-spacing: .1em; text-transform: uppercase; color: var(--muted); }
  .chapter-head b { color: var(--ph); font-weight: 400; }
  .chapter > h2 { font-size: clamp(34px, 5.6vw, 58px); line-height: 1; margin-bottom: 14px; }
  .chapter > h2 em { color: var(--amber); font-style: normal; text-shadow: 0 0 10px rgba(255, 176, 32, .5); }
  .chapter > .intro { color: var(--muted); max-width: 62ch; margin: 0 0 26px; }
  .log { font: 400 21px/1.3 var(--display); letter-spacing: .02em; color: var(--amber); border-left: 3px solid var(--amber); padding: 6px 0 6px 14px; margin: 0 0 30px; max-width: 64ch; }
  .log span { color: var(--muted); margin-right: 10px; }
  .panel { background: var(--screen); border: 1px solid var(--line-2); border-radius: 8px; padding: 18px 20px; box-shadow: inset 0 0 50px rgba(59, 255, 140, .05); }
  .block-title { font: 400 26px/1.1 var(--display); letter-spacing: .04em; text-transform: uppercase; color: var(--ph); margin: 44px 0 4px; }
  .block-sub { color: var(--muted); font-size: 14px; margin: 0 0 14px; }
  .trio { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 8px 0 30px; }
  .trio div { border: 1px solid var(--line-2); padding: 12px 14px; background: var(--screen); }
  .trio b { display: block; font: 400 56px/1 var(--display); color: var(--ph); text-shadow: var(--glow); }
  .trio span { color: var(--muted); font-size: 13px; }
  @media (max-width: 560px) { .trio { grid-template-columns: minmax(0, 1fr); } }

  /* Calendar */
  .cal { max-width: 540px; }
  .cal-grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 7px; }
  .cal-grid b { font: 400 18px/1 var(--display); color: var(--faint); text-align: center; padding-bottom: 4px; }
  .day { aspect-ratio: 1; display: grid; place-items: center; font: 400 20px/1 var(--display); color: var(--faint); border: 1px solid var(--line); }
  .day.l1 { background: color-mix(in oklab, var(--ph) 16%, var(--screen)); color: var(--ink); border-color: transparent; }
  .day.l2 { background: color-mix(in oklab, var(--ph) 34%, var(--screen)); color: var(--ink); border-color: transparent; }
  .day.l3 { background: color-mix(in oklab, var(--ph) 58%, var(--screen)); color: #001a0b; border-color: transparent; }
  .day.l4 { background: var(--ph); color: #001a0b; border-color: transparent; box-shadow: 0 0 10px rgba(59, 255, 140, .6); }
  .day.streak { outline: 2px solid var(--amber); outline-offset: 2px; }
  .cal-key { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 16px; font-size: 12px; color: var(--muted); }
  .cal-key span { display: inline-flex; align-items: center; gap: 4px; }
  .cal-key .day { width: 14px; height: 14px; display: inline-block; font-size: 0; }

  /* Clock + day strip */
  .clock { width: min(440px, 100%); display: block; margin: 0 auto; overflow: visible; padding: 0 30px; }
  .clock text { fill: var(--muted); font: 400 20px var(--display); letter-spacing: .04em; }
  .clock .clock-big { fill: #EFFFF5; font: 400 46px var(--display); }
  .clock .clock-small { font: 400 17px var(--display); letter-spacing: .1em; }
  .clock .face { fill: none; stroke: var(--line-2); }
  .clock .tick { stroke: var(--faint); stroke-width: 1.5; }
  .clock .night-zone { fill: color-mix(in oklab, var(--cyan) 8%, transparent); }
  .clock .petal { filter: drop-shadow(0 0 3px currentColor); }
  .clock path[fill="var(--accent)"] { fill: var(--cyan); color: var(--cyan); }
  .clock path[fill="var(--bar)"] { fill: var(--ph-dim); color: var(--ph-dim); }
  .daystrip { position: relative; padding: 50px 0 28px; }
  .daystrip-track { position: relative; height: 14px; background: var(--track); overflow: hidden; }
  .daystrip-night { position: absolute; left: 75%; width: 25%; top: 0; bottom: 0; background: color-mix(in oklab, var(--cyan) 12%, transparent); }
  .daystrip-on { position: absolute; top: 0; bottom: 0; background: linear-gradient(90deg, var(--ph), var(--cyan)); box-shadow: 0 0 12px rgba(59, 255, 140, .5); }
  .pin { position: absolute; top: 0; text-align: center; white-space: nowrap; }
  .pin b { display: block; font: 400 26px/1 var(--display); color: #EFFFF5; }
  .pin small { display: block; font-size: 12px; color: var(--muted); }
  .pin.start { transform: translateX(-10%); } .pin.end { transform: translateX(-90%); }
  .daystrip-ticks { position: relative; height: 16px; margin-top: 8px; }
  .daystrip-ticks span { position: absolute; transform: translateX(-50%); font: 400 16px var(--display); color: var(--faint); white-space: nowrap; }
  .daystrip-ticks span:first-child { transform: none; } .daystrip-ticks span:last-child { transform: translateX(-100%); }

  /* Features, pictograms */
  .feature { margin: 48px 0 0; }
  .feature .v { font: 400 clamp(70px, 12vw, 120px)/.85 var(--display); color: #EFFFF5; text-shadow: var(--glow); }
  .feature .l { font: 400 26px/1.1 var(--display); letter-spacing: .04em; text-transform: uppercase; color: var(--ph); margin: 8px 0 4px; }
  .feature .c { color: var(--muted); font-size: 14px; margin: 0 0 16px; max-width: 62ch; }
  .picto { display: flex; flex-wrap: wrap; gap: 6px; }
  .picto svg { width: 24px; height: 24px; fill: var(--ph); filter: drop-shadow(0 0 3px rgba(59, 255, 140, .6)); }
  .picto.is-book svg { fill: var(--cyan); filter: drop-shadow(0 0 3px rgba(68, 224, 255, .6)); }
  .picto.is-folder svg { fill: var(--amber); filter: drop-shadow(0 0 3px rgba(255, 176, 32, .5)); }
  .picto.is-key svg { width: 32px; }
  .picto.is-key svg rect { fill: none; stroke: var(--amber); stroke-width: 1.6; }
  .picto.is-key svg text { fill: var(--amber) !important; }
  .picto-key { font: 400 18px var(--display); letter-spacing: .04em; color: var(--muted); margin: 10px 0 0; }
  .compare { display: grid; gap: 2px; }
  .cmp-label { font: 400 19px var(--display); letter-spacing: .03em; color: var(--muted); margin-top: 8px; text-transform: uppercase; }
  .cmp-label.you { color: var(--amber); }
  .cmp-row { display: flex; align-items: center; gap: 10px; }
  .cmp-bar { height: 16px; background: var(--ph-dim); }
  .cmp-bar.you { background: var(--amber); box-shadow: 0 0 12px rgba(255, 176, 32, .5); }
  .cmp-row span { font: 400 22px var(--display); color: var(--ink); white-space: nowrap; }
  .split-bar { display: flex; gap: 2px; height: 22px; }
  .split-bar div { box-shadow: 0 0 10px rgba(0, 0, 0, .4); }
  .strip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 44px; }
  @media (max-width: 640px) { .strip { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  .strip div { background: var(--screen); border: 1px solid var(--line-2); padding: 14px; }
  .strip b { display: block; font: 400 48px/1 var(--display); color: var(--cyan); text-shadow: 0 0 10px rgba(68, 224, 255, .45); }
  .strip span { display: block; font: 400 20px/1.1 var(--display); letter-spacing: .03em; text-transform: uppercase; color: var(--ph); margin-top: 4px; }
  .strip small { display: block; font-size: 12px; color: var(--muted); margin-top: 6px; }
  .bars { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 7px 12px; align-items: center; font: 400 20px/1 var(--display); letter-spacing: .03em; }
  .bars .bar { height: 14px; background: var(--ph); box-shadow: 0 0 8px rgba(59, 255, 140, .5); min-width: 2px; }
  .bars .val { font: 400 20px var(--display); color: var(--muted); margin-left: 8px; white-space: nowrap; }
  .bars .row { display: flex; align-items: center; min-width: 0; }

  /* Medication: physical objects on the bedside table */
  /* Paper objects sit in front of the screen, so the scanline overlay doesn't cover them. */
  .medbox, .leaflet, .rx { position: relative; z-index: 60; }
  .medication { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 34px; align-items: start; }
  @media (max-width: 820px) { .medication { grid-template-columns: minmax(0, 1fr); } }
  .medbox { display: grid; grid-template-columns: 44px minmax(0, 1fr); background: #F7F8F5; color: #121A3A; rotate: -2deg; box-shadow: 0 30px 50px -20px #000, 0 0 0 1px #d9ddd2; font-family: 'Archivo Narrow', sans-serif; }
  .medbox-band { background: #D8432F; border-right: 8px solid #121A3A; }
  .medbox-body { padding: 22px 22px 16px; }
  .medbox-lab { font: 700 11px/1.2 'Archivo Narrow'; letter-spacing: .2em; text-transform: uppercase; }
  .medbox-name { font: 700 clamp(46px, 6vw, 62px)/.9 'Archivo Narrow'; text-transform: uppercase; letter-spacing: -.01em; margin-top: 12px; }
  .medbox-name sup { font-size: .32em; vertical-align: top; }
  .medbox-dose { display: flex; align-items: baseline; gap: 8px; margin-top: 6px; }
  .medbox-dose b { font: 700 86px/.85 'Archivo Narrow'; color: #D8432F; letter-spacing: -.03em; }
  .medbox-dose span { font: 700 24px 'Archivo Narrow'; }
  .medbox-ind { font: 700 17px/1.25 'Archivo Narrow'; margin-top: 14px; }
  .medbox-ind small { display: block; font-weight: 500; font-size: 13px; opacity: .7; margin-top: 3px; }
  .medbox-foot { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 18px; }
  .medbox-bars { display: flex; gap: 2px; height: 34px; }
  .medbox-bars i { background: #121A3A; }
  .medbox-foot span { color: #b9bdc7; letter-spacing: 3px; }
  .leaflet { background: #F4F1E8; color: #1c1c1c; padding: 22px 22px 16px; rotate: 1.2deg; box-shadow: 0 30px 50px -20px #000; font: 400 14px/1.45 'IBM Plex Mono', monospace;
    background-image: linear-gradient(90deg, transparent calc(50% - 1px), rgba(0,0,0,.06) 50%, transparent calc(50% + 1px)); }
  .leaflet-head { font: 700 13px/1.2 'Archivo Narrow'; letter-spacing: .14em; text-transform: uppercase; border-bottom: 2px solid #1c1c1c; padding-bottom: 8px; margin: 0 0 12px; display: flex; justify-content: space-between; }
  .leaflet h3 { font: 700 26px/1.05 'Archivo Narrow'; color: #1c1c1c; text-transform: uppercase; text-shadow: none; margin: 0 0 4px; }
  .leaflet-sub { font-size: 12px; color: #555; margin: 0; }
  .leaflet ul { list-style: none; padding: 0; margin: 12px 0; }
  .leaflet li { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px dotted #999; }
  .leaflet li small { color: #666; white-space: nowrap; font-size: 11px; }
  .leaflet-foot { font-style: italic; font-size: 12px; color: #555; margin: 0; }
  .pills { display: grid; grid-template-columns: repeat(10, minmax(0, 1fr)); gap: 12px 8px; max-width: 480px; margin-bottom: 16px; }
  .pills i { justify-self: center; width: 78%; height: 12px; border-radius: 6px; rotate: -35deg; box-shadow: 0 0 6px currentColor; }

  /* Radar */
  .radar { width: min(460px, 100%); display: block; margin: 0 auto 24px; overflow: visible; }
  .radar .grid-line { fill: none; stroke: var(--line-2); }
  .radar .shape { fill: rgba(59, 255, 140, .14); stroke: var(--ph); stroke-width: 2.5; stroke-linejoin: round; filter: drop-shadow(0 0 5px var(--ph)); }
  .radar .dot { fill: var(--ph); stroke: var(--screen); stroke-width: 2; }
  .radar .axis-label { fill: var(--ph); font: 400 22px var(--display); letter-spacing: .04em; text-transform: uppercase; }
  .radar .axis-value { fill: var(--amber); font: 400 18px var(--display); }
  .meter { display: inline-block; vertical-align: middle; width: 88px; height: 8px; background: var(--track); }
  .meter span { display: block; height: 100%; background: var(--ph); box-shadow: 0 0 6px var(--ph); }
  tr.sub td { border-top: 0; padding-top: 0; }
  .flag { font: 400 17px/1 var(--display); letter-spacing: .06em; color: var(--amber); }

  /* Prognosis: event log + a paper prescription */
  .rx { max-width: 520px; margin: 28px 0 0; background: #F4F1E8; color: #1b1b1b; padding: 22px 26px 16px; rotate: -1deg; box-shadow: 0 30px 50px -20px #000; }
  .rx-head { display: flex; gap: 14px; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #c9c4b4; }
  .rx-mark { font: 700 52px/1 'Archivo Narrow'; color: #D8432F; }
  .rx-head b { display: block; font: 700 20px/1.2 'Archivo Narrow'; text-transform: uppercase; letter-spacing: .04em; }
  .rx-head small { color: #666; font-size: 12px; }
  .rx ol { font: 30px/1.1 var(--hand); color: #1f3fb0; padding-left: 26px; margin: 14px 0 8px; }
  .rx ol li { margin-bottom: 6px; }
  .rx-foot { display: flex; justify-content: space-between; align-items: center; }
  .signature { width: 190px; height: 52px; fill: none; stroke: #1f3fb0; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
  .stamp { display: inline-block; border: 3px solid #C8372D; color: #C8372D; font: 700 18px/1 'Archivo Narrow'; letter-spacing: .14em; text-transform: uppercase; padding: 6px 10px; rotate: -9deg; opacity: .85; }

  .share-end { text-align: center; }
  .share-end .btn-row { justify-content: center; }
  .share-end .card-canvas { margin-top: 10px; }
  .column .cta { grid-template-columns: minmax(0, 1fr); }
  .wobble { display: inline-block; }

  /* Motion (report-page.js adds html.anim; never with reduced motion) */
  html.anim .reveal { opacity: 0; translate: 0 24px; transition: opacity .7s ease, translate .7s cubic-bezier(.2, .8, .2, 1); }
  html.anim .reveal.in { opacity: 1; translate: 0 0; }
  html.anim .reveal .picto svg, html.anim .reveal .day, html.anim .reveal .pills i { opacity: 0; transition: opacity .25s; transition-delay: calc(var(--i) * 20ms); }
  html.anim .reveal.in .picto svg, html.anim .reveal.in .day, html.anim .reveal.in .pills i { opacity: 1; }
  html.anim .ecg-line { stroke-dasharray: 6000; stroke-dashoffset: 6000; animation: trace 2.4s linear .3s forwards; }
  @keyframes trace { to { stroke-dashoffset: 0; } }
  html.anim .reveal .petal { opacity: 0; scale: .35; transform-origin: 200px 200px; transition: opacity .4s, scale .7s cubic-bezier(.2, 1.3, .4, 1); transition-delay: calc(var(--i) * 35ms); }
  html.anim .reveal.in .petal { opacity: 1; scale: 1; }
  html.anim .reveal .cmp-bar, html.anim .reveal .split-bar div { scale: 0 1; transform-origin: left; transition: scale 1s cubic-bezier(.2, .8, .2, 1) .2s; }
  html.anim .reveal.in .cmp-bar, html.anim .reveal.in .split-bar div { scale: 1 1; }
  html.anim .reveal .radar .shape, html.anim .reveal .radar .dot { scale: 0; transform-origin: 210px 210px; transition: scale 1s cubic-bezier(.2, 1.2, .4, 1) .2s; }
  html.anim .reveal.in .radar .shape, html.anim .reveal.in .radar .dot { scale: 1; }
  html.anim .rx .signature path { stroke-dasharray: 700; stroke-dashoffset: 700; }
  html.anim .rx.in .signature path { animation: sign 1.8s ease-out .4s forwards; }
  @keyframes sign { to { stroke-dashoffset: 0; } }
`;

function strip(r) {
  const byKey = Object.fromEntries(usageFacts(r.usage).map((f) => [f.key, f]));
  return ['tokens', 'bash', 'claude-hours', 'web', 'mcp', 'compactions']
    .map((k) => byKey[k])
    .filter(Boolean)
    .map((f) => `<div><b>${esc(f.value)}</b><span>${esc(f.label)}</span><small>${esc(f.caption)}</small></div>`)
    .join('');
}

function feature(value, label, caption, visual) {
  if (!visual) return '';
  return `<div class="feature reveal"><div class="v">${esc(value)}</div><div class="l">${esc(label)}</div><p class="c">${esc(caption)}</p>${visual}</div>`;
}

const chapter = (no, name, extra = '') => `<div class="chapter-head"><span><b>${no}</b> · ${esc(name)}</span><span>${extra}</span></div>`;

export function renderReportPage(entry, origin) {
  const r = entry.report;
  const u = r.usage;
  const t = u.toolCalls;
  const stage = STAGES[r.stage];
  const arch = ARCHETYPES[r.archetype];
  const slug = entry.slug;
  const pageUrl = `${origin}/case/${slug}`;
  const title = `Claude Dependency: ${r.score}/100, Stage ${r.stage} (${stage.name}) · Claude Dependency Test`;
  const description = `Diagnosis: ${arch.name}. ${arch.tagline} ${n(r.sample.prompts)} prompts to Claude, ${r.sample.activeHours.toFixed(0)} active hours in ${r.window.days} days. How addicted to Claude are you?`;
  const badge = `[![Claude Dependency: Stage ${r.stage}](${origin}/badge/${slug})](${pageUrl})`;
  const data = { slug, url: pageUrl, report: r };
  const updated = entry.updatedAt ? `Updated ${fmtDay(entry.updatedAt.slice(0, 10))}` : 'Example report';
  const facts = Object.fromEntries(usageFacts(u).map((f) => [f.key, f]));
  const caseNo = slug === 'demo' ? 'DEMO-0001' : `${slug.slice(0, 4)}-${slug.slice(4)}`.toUpperCase();
  const notes = doctorNotes(r);
  const log = (k) => (notes[k] ? `<p class="log reveal"><span>▸ NURSE NOTE</span>${esc(notes[k])}</p>` : '');
  const typing = typingTime(u.outputTokens);
  const books = typing.books;
  const edits = (t.Edit || 0) + (t.MultiEdit || 0) + (t.Write || 0) + (t.NotebookEdit || 0);
  const topFamily = Object.entries(r.modelMix).sort((a, b) => b[1] - a[1])[0];
  const alarm = arch.alarm || '● STABLE';
  const heads = headlines(r, 5);
  const readout = heads.map((h) => `<div><span class="lbl">${esc(h.label)}</span><b style="color:var(--${h.color})">${esc(h.value)}</b><small>${esc(h.hint)}</small></div>`).join('');

  return `${head({ title, description, image: `${origin}/og/${slug}`, canonical: pageUrl, extraCss: CSS, indexable: slug === 'demo' })}
  <header class="monitor" aria-label="Patient monitor">
    <div class="mon-bar"><span class="rec">Claude Dependency Monitor</span><span>Bed 04 · Case #${esc(caseNo)} · anonymous developer</span><span class="alarm${alarm.startsWith('▲') ? '' : ' ok'}">${esc(alarm)}</span></div>
    <div class="mon-grid">
      <div><div class="lbl"><span>II · Prompts to Claude per day</span><span>${r.window.days} D · ${esc(fmtDay(r.window.startDay))} → ${esc(fmtDay(r.window.endDay))}</span></div>${ecg(r.daily, r.window.startDay)}<p class="ecg-legend">One spike per day. The taller the spike, the more prompts you sent Claude that day. Flat line: a day off.</p></div>
      <div class="mon-score"><div class="lbl"><span>Claude dependency</span><span>/100</span></div><b data-count="${r.score}" aria-label="${r.score} out of 100">${r.score}</b><div class="stg" style="color:var(--s${r.stage})">Stage ${r.stage} · ${esc(stage.name.toUpperCase())}</div></div>
    </div>
    ${stageScale(r.score, r.stage)}
    <div class="mon-dx"><div class="lbl amber"><span>DX · ${esc(arch.code)}</span></div><h1>${esc(arch.name)}</h1><p>${esc(arch.tagline)}</p></div>
    <div class="mon-read-title">Headlines · the most spectacular numbers in this chart</div>
    <div class="mon-read">${readout}</div>
  </header>
  <div class="hero-actions">${shareButtons}<a class="scroll-hint" href="#attendance">▼ FULL CHART</a></div>

  <main class="column">
    <section class="chapter" id="attendance">
      ${chapter('01', 'Attendance', `${r.window.days}-day observation`)}
      <h2>${r.sample.activeDays === r.window.days ? 'Present <em>every single day</em>.' : `Present <em>${r.sample.activeDays} days</em> out of ${r.window.days}.`}</h2>
      ${log('attendance')}
      <div class="trio reveal">
        <div><b>${n(r.sample.prompts)}</b><span>prompts to Claude, ${n(r.sample.prompts / Math.max(1, r.sample.activeDays))} per active day</span></div>
        <div><b>${r.sample.activeHours.toFixed(0)} H</b><span>of active time in ${n(r.sample.sessions)} sessions</span></div>
        <div><b>${esc(fmtDay(r.extras.busiestDay.day)).toUpperCase()}</b><span>busiest day, ${n(r.extras.busiestDay.prompts)} prompts</span></div>
      </div>
      <div class="reveal">${attendance(r)}</div>
    </section>

    <section class="chapter">
      ${chapter('02', 'Circadian rhythm', `peak ${esc(formatHour(r.extras.peakHour))}`)}
      <h2>${u.earliestMorningMinute != null && u.latestNightMinute != null ? `On duty from <em>${esc(formatMinuteOfDay(u.earliestMorningMinute))}</em> to <em>${esc(formatMinuteOfDay(u.latestNightMinute))}</em>.` : `Peak hour: <em>${esc(formatHour(r.extras.peakHour))}</em>.`}</h2>
      ${log('clock')}
      <div class="panel reveal">${radialClock(r.hours, r.extras.peakHour)}</div>
      <p class="block-title">Your Claude day</p>
      <p class="block-sub">Earliest first prompt and latest last prompt over the whole period.</p>
      ${dayStrip(u.earliestMorningMinute, u.latestNightMinute)}
      <p class="block-title">Weekly pattern</p>
      <p class="block-sub">Prompts by day of week. Weekends highlighted. Busiest: ${esc(WEEKDAYS[r.extras.peakWeekday])}.</p>
      <div class="panel"><div class="chart" id="chart-weekdays"></div></div>
    </section>

    <section class="chapter">
      ${chapter('03', 'Side effects', 'counted, not estimated')}
      <h2>${u.outputTokens > 0 ? `Claude wrote you <em>${esc(compact(typing.words))} words</em>.` : 'Side effects.'}</h2>
      ${log('effects')}
      ${feature(`${books >= 10 ? Math.round(books) : books.toFixed(1)}×`, 'War and Peace, written by Claude', facts.words ? `One book = one War and Peace (587,287 words). Typing all that at 40 words a minute, nonstop: ${n(typing.days)} days. Thinking included.` : '', pictogram(books, 'book', { max: 60, one: 'book', many: 'copies of War and Peace' }))}
      <div class="strip reveal">${strip(r)}</div>
      ${feature(n(t.Read || 0) + ' / ' + n(edits), 'File reads / edits', 'Reads first, edits later. Mostly.', splitBar(t.Read || 0, edits, 'reads', 'edits'))}
      <p class="block-title">Procedures performed</p>
      <p class="block-sub">What Claude reached for most, in tool calls.</p>
      <div class="panel"><div class="chart" id="chart-tools"></div></div>
      ${feature(n(u.subagents), 'Subagents hired', 'Claude delegates, like a real manager.', pictogram(u.subagents, 'person', { one: 'person', many: 'subagents' }))}
      ${facts['longest-turn'] ? feature(facts['longest-turn'].value, 'Longest solo run by Claude', 'On a single request, unattended. For scale:', durationCompare(u.longestTurnMinutes)) : ''}
      ${feature(n(u.interruptions), facts.interruptions.label, facts.interruptions.caption, pictogram(u.interruptions, 'key', { one: 'key', many: 'interruptions' }))}
      ${facts.projects ? feature(n(u.projects), facts.projects.label, facts.projects.caption, pictogram(u.projects, 'folder', { one: 'folder', many: 'projects' })) : ''}
    </section>

    <section class="chapter">
      ${chapter('04', 'Medication', 'Rx only')}
      <h2>Prescribed: <em>Claudoxine ${r.score} mg</em>.</h2>
      ${log('medication')}
      <div class="medication reveal">
        ${medicineBox(r)}
        <div class="leaflet">
          <p class="leaflet-head"><span>Claudoxine®</span><span>Package leaflet</span></p>
          <h3>Possible side effects</h3>
          <p class="leaflet-sub">Observed in this patient. Each one is backed by a number.</p>
          <ul>${sideEffects(r).map((x) => `<li><span>${esc(x.text)}</span><small>${esc(x.evidence)}</small></li>`).join('')}</ul>
          <p class="leaflet-foot">If side effects persist, keep shipping.</p>
        </div>
      </div>
      <p class="block-title">Active ingredients</p>
      <p class="block-sub">${topFamily ? `${esc(topFamily[0][0].toUpperCase() + topFamily[0].slice(1))}, ${Math.round(topFamily[1] * 100)}% of the time. ` : ''}100 pills, one per 1% of Claude's responses, colored by model.</p>
      <div class="panel reveal">${pillWaffle(r.modelMix)}</div>
    </section>

    <section class="chapter">
      ${chapter('05', 'Symptom profile', `${r.score}/100`)}
      <h2>Where the <em>${r.score} points</em> came from.</h2>
      ${log('profile')}
      <p class="intro">Share of each symptom's points earned. Each one is scored linearly between two reference values. <a href="/#methodology">Full rules</a></p>
      <div class="panel reveal">${radar(r.criteria)}</div>
      <div class="table-wrap" style="margin-top:14px"><table>
        <thead><tr><th>Symptom</th><th>Result</th><th>Reference</th><th>Severity</th><th>Points</th></tr></thead>
        <tbody>${symptomRows(r)}</tbody>
      </table></div>
    </section>

    <section class="chapter">
      ${chapter('06', 'Prognosis', esc(updated))}
      <h2>${esc(stage.prognosis)}</h2>
      <div class="rx reveal">
        <div class="rx-head"><span class="rx-mark">℞</span><div><b>Claude Dependency Clinic</b><small>Patient: anonymous developer · Case #${esc(caseNo)} · ${esc(fmtDay(r.window.endDay))}</small></div></div>
        <ol>${prescription(r).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
        <div class="rx-foot"><svg class="signature" viewBox="0 0 220 60" aria-hidden="true"><path d="M6 44c14-30 26-36 30-22s-10 30-4 30 18-34 30-36 4 26 12 26 14-22 22-22 2 20 10 20 16-26 26-26-2 24 8 24 20-14 30-16 12 6 30 2"/></svg><span class="stamp" aria-hidden="true">Approved</span></div>
      </div>
      <p class="muted small" style="margin-top:22px">Computed on the patient's machine from Claude Code usage patterns. This page holds aggregate numbers only: no prompts, code, file paths or project names.</p>
    </section>

    <section class="chapter share-end">
      ${chapter('07', 'Discharge', 'share the chart')}
      <h2>Stage ${r.stage}. <em>${esc(stage.name)}.</em> Tell your friends.</h2>
      <canvas id="card" class="card-canvas" width="1200" height="630" role="img" aria-label="${esc(title)}"></canvas>
      ${shareButtonsHtml('-2')}
      ${followBlock()}
    </section>

    ${installCta}
    ${badgeBlock(badge)}
  </main>
  ${footer(' · Published this page? Delete it anytime with <code>/claude-dependency-test:diagnose --unpublish</code>.')}
<script type="application/json" id="report-data">${safeJson(data)}</script>
<script type="module" src="/report-page.js"></script>
</body>
</html>`;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get('slug') || url.pathname.split('/case/')[1] || '';
  const entry = slug === 'demo' ? { slug: 'demo', report: DEMO_REPORT } : await loadReport(slug);
  if (!entry) {
    return htmlResponse(`${head({ title: 'Report not found · Claude Dependency Test', description: 'This lab report was deleted or has expired.', image: `${url.origin}/og`, canonical: `${url.origin}/` })}
  <header class="result"><p class="kicker">404</p><h1>This lab report has left the building.</h1>
  <p class="lead">It was deleted by its patient, or it expired after a year without a checkup.</p></header>
  ${installCta}${footer()}
<script type="module" src="/report-page.js"></script>
</body></html>`, { status: 404, cache: 'no-store' });
  }
  // Short CDN cache: an unpublished or updated case file must disappear quickly everywhere.
  return htmlResponse(renderReportPage(entry, url.origin), { cache: slug === 'demo' ? 'public, max-age=300, s-maxage=3600' : 'public, max-age=60, s-maxage=60' });
}
