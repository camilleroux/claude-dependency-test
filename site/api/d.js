// GET /case/:slug : the online lab report for a published diagnosis (the patient's case file).
import {
  ARCHETYPES,
  ARCHETYPES_FR,
  CRITERIA,
  CRITERIA_FR,
  METRICS,
  METRIC_LABELS_FR,
  STAGES,
  STAGES_FR,
  compact,
  formatHour,
  formatMinuteOfDay,
  rankText,
  headlines,
  severityFlag,
  usageFacts,
  weekdays,
} from '../public/card.js';
import { doctorNotes, prescription, sideEffects, treatment, typingTime } from '../lib/notes.js';
import { attendance, dayStrip, durationCompare, ecg, medicineBox, pictogram, pillWaffle, radar, radialClock, splitBar, stageScale } from '../lib/infographics.js';
import { DEMO_REPORT } from '../lib/demo.js';
import { getStore, loadReport } from '../lib/store.js';
import { rankFor, safely } from '../lib/rank.js';
import { badgeBlock, detectLang, esc, followBlock, footer, head, htmlResponse, installCtaHtml, safeJson, shareButtonsHtml, withLang } from '../lib/layout.js';

export const config = { runtime: 'edge' };


const frNum = (s) => String(s)
  .replace(/(\d)\.(\d)/g, '$1,$2')
  .replace(/(\d)%/g, '$1 %')
  .replace(/(\d)K\b/g, '$1 k')
  .replace(/\bdays?\b/g, 'jours')
  .replace(/(\d) d\b/g, '$1 j');

function symptomRows(r, lang = 'en') {
  const fr = lang === 'fr';
  const rows = [];
  for (const c of r.criteria) {
    const label = (fr ? CRITERIA_FR : CRITERIA)[c.key];
    if (c.earned === null) {
      rows.push(`<tr class="na"><td>${esc(label)}</td><td colspan="3" class="muted">${fr ? 'Non évalué : pas mesurable avec ces données. Le score a été renormalisé.' : 'Not assessed: not measurable from this data. The score was renormalized.'}</td><td class="num">–/${c.points}</td></tr>`);
      continue;
    }
    const ratio = c.points ? c.earned / c.points : 0;
    c.parts.forEach((p, i) => {
      const f = METRICS[p.metric];
      const mlabel = fr ? METRIC_LABELS_FR[p.metric] || f.label : f.label;
      const v = fr ? frNum(f.value(p.value)) : f.value(p.value);
      const ref = fr ? frNum(f.ref(p.from, p.to)) : f.ref(p.from, p.to);
      const earned = fr ? c.earned.toFixed(1).replace('.', ',') : c.earned.toFixed(1);
      const meter = i === 0
        ? `<span class="meter" role="img" aria-label="${esc(fr ? `${earned} points sur ${c.points}` : `${earned} of ${c.points} points`)}"><span style="width:${Math.round(ratio * 100)}%"></span></span>`
        : '';
      const flag = severityFlag(ratio);
      const flagText = fr ? { HIGH: 'ÉLEVÉ', ELEV: 'ACCRU' }[flag] || '' : flag;
      rows.push(`<tr${i ? ' class="sub"' : ''}><td>${esc(i ? `↳ ${mlabel}` : c.parts.length > 1 ? `${label} : ${mlabel.toLowerCase()}` : label)}</td>`
        + `<td class="num">${esc(v)}</td><td class="num muted">${esc(ref)}</td>`
        + `<td>${meter}${i === 0 && flagText ? ` <span class="flag">${flagText}</span>` : ''}</td>`
        + `<td class="num">${i === 0 ? `${earned}/${c.points}` : ''}</td></tr>`);
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
  .mon-score .rank { font: 400 24px/1.1 var(--display); text-align: right; letter-spacing: .04em; text-transform: uppercase; margin-top: 12px; color: var(--ph); text-shadow: 0 0 8px currentColor; }
  .mon-score .rank.more { color: var(--amber); }
  .mon-score .rank small { display: block; font-size: 17px; color: var(--muted); text-shadow: none; margin-top: 2px; }
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
  .rx-treatment { border: 1.5px dashed #1f3fb0; border-radius: 3px; padding: 10px 12px; margin: 4px 0 12px; }
  .rx-label { display: block; font: 700 12px/1 'Archivo Narrow'; letter-spacing: .14em; text-transform: uppercase; color: #D8432F; margin-bottom: 6px; }
  .rx-treatment a { font: 700 19px/1.2 'Archivo Narrow'; color: #1b1b1b; text-decoration: underline; text-underline-offset: 3px; }
  .rx-treatment a:hover { color: #1f3fb0; }
  .rx-treatment p { margin: 6px 0 4px; font-size: 14px; line-height: 1.4; color: #333; }
  .rx-treatment small { font-size: 11px; color: #777; letter-spacing: .04em; }
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

function strip(r, lang = 'en') {
  const byKey = Object.fromEntries(usageFacts(r.usage, lang).map((f) => [f.key, f]));
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

export function renderReportPage(entry, origin, lang = 'en') {
  const fr = lang === 'fr';
  const L = (en, frText) => (fr ? frText : en);
  const r = entry.report;
  const u = r.usage;
  const t = u.toolCalls;
  const stage = (fr ? STAGES_FR : STAGES)[r.stage];
  const archEn = ARCHETYPES[r.archetype];
  const arch = fr ? { ...archEn, ...ARCHETYPES_FR[r.archetype] } : archEn;
  const num = (v) => Math.round(v).toLocaleString(fr ? 'fr-FR' : 'en-US');
  const day = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const slug = entry.slug;
  const pageUrl = `${origin}/case/${slug}`;
  const alternates = { en: pageUrl, fr: withLang(pageUrl, 'fr') };
  const canonical = fr ? alternates.fr : pageUrl;
  const title = fr
    ? `Dépendance à Claude : ${r.score}/100, stade ${r.stage} (${stage.name.toLowerCase()}) · Claude Dependency Test`
    : `Claude Dependency: ${r.score}/100, Stage ${r.stage} (${stage.name}) · Claude Dependency Test`;
  const description = fr
    ? `Diagnostic : ${arch.name}. ${arch.tagline} ${num(r.sample.prompts)} prompts envoyés à Claude, ${r.sample.activeHours.toFixed(0)} heures actives en ${r.window.days} jours. À quel point es-tu accro à Claude ?`
    : `Diagnosis: ${arch.name}. ${arch.tagline} ${num(r.sample.prompts)} prompts to Claude, ${r.sample.activeHours.toFixed(0)} active hours in ${r.window.days} days. How addicted to Claude are you?`;
  const badge = `[![Claude Dependency: Stage ${r.stage}](${origin}/badge/${slug})](${pageUrl})`;
  const rank = entry.rank || null;
  const data = { slug, url: pageUrl, report: r, lang, rank };
  const updated = entry.updatedAt ? L(`Updated ${day(entry.updatedAt.slice(0, 10))}`, `Mis à jour le ${day(entry.updatedAt.slice(0, 10))}`) : L('Example report', 'Dossier exemple');
  const facts = Object.fromEntries(usageFacts(u, lang).map((f) => [f.key, f]));
  const caseNo = slug === 'demo' ? 'DEMO-0001' : `${slug.slice(0, 4)}-${slug.slice(4)}`.toUpperCase();
  const notes = doctorNotes(r, lang);
  const log = (k) => (notes[k] ? `<p class="log reveal"><span>▸ ${L('NURSE NOTE', 'NOTE INFIRMIÈRE')}</span>${esc(notes[k])}</p>` : '');
  const typing = typingTime(u.outputTokens);
  const books = typing.books;
  const edits = (t.Edit || 0) + (t.MultiEdit || 0) + (t.Write || 0) + (t.NotebookEdit || 0);
  const topFamily = Object.entries(r.modelMix).sort((a, b) => b[1] - a[1])[0];
  const alarm = arch.alarm || '● STABLE';
  const heads = headlines(r, 5, lang);
  const readout = heads.map((h) => `<div><span class="lbl">${esc(h.label)}</span><b style="color:var(--${h.color})">${esc(h.value)}</b><small>${esc(h.hint)}</small></div>`).join('');
  const bookCount = books >= 10 ? String(Math.round(books)) : fr ? books.toFixed(1).replace('.', ',') : books.toFixed(1);
  const wd = weekdays(lang);
  const rx = treatment(r, lang);

  return `${head({ title, description, image: `${origin}/og/${slug}`, canonical, extraCss: CSS, indexable: slug === 'demo', lang, alternates })}
  <header class="monitor" aria-label="${L('Patient monitor', 'Moniteur du patient')}">
    <div class="mon-bar"><span class="rec">Claude Dependency Monitor</span><span>${L(`Bed 04 · Case #${esc(caseNo)} · anonymous developer`, `Lit 04 · Dossier nº ${esc(caseNo)} · développeur anonyme`)}</span><span class="alarm${alarm.startsWith('▲') ? '' : ' ok'}">${esc(alarm)}</span></div>
    <div class="mon-grid">
      <div><div class="lbl"><span>${L('II · Prompts to Claude per day', 'II · Prompts à Claude par jour')}</span><span>${r.window.days} ${L('D', 'J')} · ${esc(day(r.window.startDay))} → ${esc(day(r.window.endDay))}</span></div>${ecg(r.daily, r.window.startDay, lang)}<p class="ecg-legend">${L('One spike per day. The taller the spike, the more prompts you sent Claude that day. Flat line: a day off.', "Un pic par jour. Plus il est haut, plus tu as envoyé de prompts à Claude ce jour-là. Ligne plate : jour de repos.")}</p></div>
      <div class="mon-score"><div class="lbl"><span>${L('Claude dependency', 'Dépendance à Claude')}</span><span>/100</span></div><b data-count="${r.score}" aria-label="${r.score} ${L('out of 100', 'sur 100')}">${r.score}</b><div class="stg" style="color:var(--s${r.stage})">${L('Stage', 'Stade')} ${r.stage} · ${esc(stage.name.toUpperCase())}</div>${rank ? `<div class="rank ${rank.dir}">${rank.dir === 'more' ? '▲' : '▼'} ${esc(rankText(rank, lang))}<small>${L(`among ${rank.total} patients diagnosed`, `parmi ${rank.total} patients diagnostiqués`)}</small></div>` : ''}</div>
    </div>
    ${stageScale(r.score, r.stage, lang)}
    <div class="mon-dx"><div class="lbl amber"><span>DX · ${esc(arch.code)}</span></div><h1>${esc(arch.name)}</h1><p>${esc(arch.tagline)}${fr ? ` <span class="muted small">(${esc(archEn.name)})</span>` : ''}</p></div>
    <div class="mon-read-title">${L('Headlines · the most spectacular numbers in this chart', 'À la une · les chiffres les plus spectaculaires du dossier')}</div>
    <div class="mon-read">${readout}</div>
  </header>
  <div class="hero-actions">${shareButtonsHtml('', lang)}<a class="scroll-hint" href="#attendance">▼ ${L('FULL CHART', 'DOSSIER COMPLET')}</a></div>

  <main class="column">
    <section class="chapter" id="attendance">
      ${chapter('01', L('Attendance', 'Assiduité'), L(`${r.window.days}-day observation`, `observation sur ${r.window.days} jours`))}
      <h2>${r.sample.activeDays === r.window.days ? L('Present <em>every single day</em>.', 'Présent <em>tous les jours</em>.') : L(`Present <em>${r.sample.activeDays} days</em> out of ${r.window.days}.`, `Présent <em>${r.sample.activeDays} jours</em> sur ${r.window.days}.`)}</h2>
      ${log('attendance')}
      <div class="trio reveal">
        <div><b>${num(r.sample.prompts)}</b><span>${L(`prompts to Claude, ${num(r.sample.prompts / Math.max(1, r.sample.activeDays))} per active day`, `prompts envoyés à Claude, ${num(r.sample.prompts / Math.max(1, r.sample.activeDays))} par jour actif`)}</span></div>
        <div><b>${r.sample.activeHours.toFixed(0)} H</b><span>${L(`of active time in ${num(r.sample.sessions)} sessions`, `de temps actif en ${num(r.sample.sessions)} sessions`)}</span></div>
        <div><b>${esc(day(r.extras.busiestDay.day)).toUpperCase()}</b><span>${L(`busiest day, ${num(r.extras.busiestDay.prompts)} prompts`, `journée la plus chargée, ${num(r.extras.busiestDay.prompts)} prompts`)}</span></div>
      </div>
      <div class="reveal">${attendance(r, lang)}</div>
    </section>

    <section class="chapter">
      ${chapter('02', L('Circadian rhythm', 'Rythme circadien'), `${L('peak', 'pic')} ${esc(formatHour(r.extras.peakHour, lang))}`)}
      <h2>${u.earliestMorningMinute != null && u.latestNightMinute != null ? L(`On duty from <em>${esc(formatMinuteOfDay(u.earliestMorningMinute))}</em> to <em>${esc(formatMinuteOfDay(u.latestNightMinute))}</em>.`, `De garde de <em>${esc(formatMinuteOfDay(u.earliestMorningMinute, lang))}</em> à <em>${esc(formatMinuteOfDay(u.latestNightMinute, lang))}</em>.`) : L(`Peak hour: <em>${esc(formatHour(r.extras.peakHour))}</em>.`, `Heure de pointe : <em>${esc(formatHour(r.extras.peakHour, lang))}</em>.`)}</h2>
      ${log('clock')}
      <div class="panel reveal">${radialClock(r.hours, r.extras.peakHour, lang)}</div>
      <p class="block-title">${L('Your Claude day', 'Ta journée avec Claude')}</p>
      <p class="block-sub">${L('Earliest first prompt and latest last prompt over the whole period.', 'Le premier prompt le plus tôt et le dernier prompt le plus tard, sur toute la période.')}</p>
      ${dayStrip(u.earliestMorningMinute, u.latestNightMinute, lang)}
      <p class="block-title">${L('Weekly pattern', 'Semaine type')}</p>
      <p class="block-sub">${L(`Prompts by day of week. Weekends highlighted. Busiest: ${esc(wd[r.extras.peakWeekday])}.`, `Prompts par jour de la semaine. Week-ends en évidence. Jour le plus chargé : ${esc(wd[r.extras.peakWeekday])}.`)}</p>
      <div class="panel"><div class="chart" id="chart-weekdays"></div></div>
    </section>

    <section class="chapter">
      ${chapter('03', L('Side effects', 'Effets secondaires'), L('counted, not estimated', 'comptés, pas estimés'))}
      <h2>${u.outputTokens > 0 ? L(`Claude wrote you <em>${esc(compact(typing.words))} words</em>.`, `Claude t'a écrit <em>${esc(compact(typing.words, lang))} de mots</em>.`) : L('Side effects.', 'Effets secondaires.')}</h2>
      ${log('effects')}
      ${feature(`${bookCount}×`, L('War and Peace, written by Claude', 'Guerre et Paix, écrits par Claude'), facts.words ? L(`One book = one War and Peace (587,287 words). Typing all that at 40 words a minute, nonstop: ${num(typing.days)} days. Thinking included.`, `Un livre = un Guerre et Paix (587 287 mots). Taper tout ça à 40 mots par minute, sans pause : ${num(typing.days)} jours. Réflexion comprise.`) : '', pictogram(books, 'book', { max: 60, one: L('book', 'livre'), many: L('copies of War and Peace', 'exemplaires de Guerre et Paix'), lang }))}
      <div class="strip reveal">${strip(r, lang)}</div>
      ${feature(num(t.Read || 0) + ' / ' + num(edits), L('File reads / edits', 'Lectures / modifications de fichiers'), L('Reads first, edits later. Mostly.', "On lit d'abord, on modifie ensuite. En général."), splitBar(t.Read || 0, edits, L('reads', 'lectures'), L('edits', 'modifications'), lang))}
      <p class="block-title">${L('Procedures performed', 'Actes pratiqués')}</p>
      <p class="block-sub">${L('What Claude reached for most, in tool calls.', "Les outils que Claude a le plus utilisés, en nombre d'appels.")}</p>
      <div class="panel"><div class="chart" id="chart-tools"></div></div>
      ${feature(num(u.subagents), L('Subagents hired', 'Sous-agents engagés'), L('Claude delegates, like a real manager.', 'Claude délègue, comme un vrai manager.'), pictogram(u.subagents, 'person', { one: L('person', 'personnage'), many: L('subagents', 'sous-agents'), lang }))}
      ${facts['longest-turn'] ? feature(facts['longest-turn'].value, L('Longest solo run by Claude', 'Plus long travail de Claude en solo'), L('On a single request, unattended. For scale:', 'Sur une seule demande, sans surveillance. Pour comparer :'), durationCompare(u.longestTurnMinutes, lang)) : ''}
      ${feature(num(u.interruptions), facts.interruptions.label, facts.interruptions.caption, pictogram(u.interruptions, 'key', { one: L('key', 'touche'), many: L('interruptions', 'interruptions'), lang }))}
      ${facts.projects ? feature(num(u.projects), facts.projects.label, facts.projects.caption, pictogram(u.projects, 'folder', { one: L('folder', 'dossier'), many: L('projects', 'projets'), lang })) : ''}
    </section>

    <section class="chapter">
      ${chapter('04', L('Medication', 'Traitement'), L('Rx only', 'Sur ordonnance'))}
      <h2>${L(`Prescribed: <em>Claudoxine ${r.score} mg</em>.`, `Prescription : <em>Claudoxine ${r.score} mg</em>.`)}</h2>
      ${log('medication')}
      <div class="medication reveal">
        ${medicineBox(r, lang)}
        <div class="leaflet">
          <p class="leaflet-head"><span>Claudoxine®</span><span>${L('Package leaflet', 'Notice')}</span></p>
          <h3>${L('Possible side effects', 'Effets indésirables possibles')}</h3>
          <p class="leaflet-sub">${L('Observed in this patient. Each one is backed by a number.', 'Observés chez ce patient. Chacun est justifié par un chiffre.')}</p>
          <ul>${sideEffects(r, lang).map((x) => `<li><span>${esc(x.text)}</span><small>${esc(x.evidence)}</small></li>`).join('')}</ul>
          <p class="leaflet-foot">${L('If side effects persist, keep shipping.', 'Si les effets persistent, continue de livrer.')}</p>
        </div>
      </div>
      <p class="block-title">${L('Active ingredients', 'Principes actifs')}</p>
      <p class="block-sub">${topFamily ? L(`${esc(topFamily[0][0].toUpperCase() + topFamily[0].slice(1))}, ${Math.round(topFamily[1] * 100)}% of the time. `, `${esc(topFamily[0][0].toUpperCase() + topFamily[0].slice(1))}, ${Math.round(topFamily[1] * 100)} % du temps. `) : ''}${L("100 pills, one per 1% of Claude's responses, colored by model.", '100 pilules, une pour 1 % des réponses de Claude, colorées selon le modèle.')}</p>
      <div class="panel reveal">${pillWaffle(r.modelMix, lang)}</div>
    </section>

    <section class="chapter">
      ${chapter('05', L('Symptom profile', 'Profil des symptômes'), `${r.score}/100`)}
      <h2>${L(`Where the <em>${r.score} points</em> came from.`, `D'où viennent les <em>${r.score} points</em>.`)}</h2>
      ${log('profile')}
      <p class="intro">${L("Share of each symptom's points earned. Each one is scored linearly between two reference values.", 'Part des points obtenus pour chaque symptôme. Chacun est noté de façon linéaire entre deux valeurs de référence.')} <a href="${fr ? '/fr#methodology' : '/#methodology'}">${L('Full rules', 'Règles complètes')}</a></p>
      <div class="panel reveal">${radar(r.criteria, lang)}</div>
      <div class="table-wrap" style="margin-top:14px"><table>
        <thead><tr><th>${L('Symptom', 'Symptôme')}</th><th>${L('Result', 'Résultat')}</th><th>${L('Reference', 'Référence')}</th><th>${L('Severity', 'Gravité')}</th><th>Points</th></tr></thead>
        <tbody>${symptomRows(r, lang)}</tbody>
      </table></div>
    </section>

    <section class="chapter">
      ${chapter('06', L('Prognosis', 'Pronostic'), esc(updated))}
      <h2>${esc(stage.prognosis)}</h2>
      <div class="rx reveal">
        <div class="rx-head"><span class="rx-mark">℞</span><div><b>${L('Claude Dependency Clinic', 'Clinique de la dépendance à Claude')}</b><small>${L(`Patient: anonymous developer · Case #${esc(caseNo)} · ${esc(day(r.window.endDay))}`, `Patient : développeur anonyme · Dossier nº ${esc(caseNo)} · ${esc(day(r.window.endDay))}`)}</small></div></div>
        <ol>${prescription(r, lang).map((l) => `<li>${esc(l)}</li>`).join('')}</ol>
        ${rx ? `<div class="rx-treatment"><span class="rx-label">Traitement recommandé</span><a href="${esc(rx.url)}" target="_blank" rel="noopener">${esc(rx.name)} →</a><p>${esc(rx.text)}</p><small>Proposé par Human Coders</small></div>` : ''}
        <div class="rx-foot"><svg class="signature" viewBox="0 0 220 60" aria-hidden="true"><path d="M6 44c14-30 26-36 30-22s-10 30-4 30 18-34 30-36 4 26 12 26 14-22 22-22 2 20 10 20 16-26 26-26-2 24 8 24 20-14 30-16 12 6 30 2"/></svg><span class="stamp" aria-hidden="true">${L('Approved', 'Validé')}</span></div>
      </div>
      <p class="muted small" style="margin-top:22px">${L("Computed on the patient's machine from Claude Code usage patterns. This page holds aggregate numbers only: no prompts, code, file paths or project names.", "Calculé sur la machine du patient à partir de son usage de Claude Code. Cette page ne contient que des chiffres agrégés : aucun prompt, aucun code, aucun chemin de fichier ni nom de projet.")}</p>
    </section>

    <section class="chapter share-end">
      ${chapter('07', L('Discharge', 'Sortie'), L('share the chart', 'partage le dossier'))}
      <h2>${L(`Stage ${r.stage}. <em>${esc(stage.name)}.</em> Tell your friends.`, `Stade ${r.stage}. <em>${esc(stage.name)}.</em> Dis-le à tes amis.`)}</h2>
      <canvas id="card" class="card-canvas" width="1200" height="630" role="img" aria-label="${esc(title)}"></canvas>
      ${shareButtonsHtml('-2', lang)}
      ${followBlock(lang)}
    </section>

    ${installCtaHtml(lang)}
    ${badgeBlock(badge, lang)}
  </main>
  ${footer(L(' · Published this page? Delete it anytime with <code>/claude-dependency-test:diagnose --unpublish</code>.', ' · Tu as publié cette page ? Supprime-la à tout moment avec <code>/claude-dependency-test:diagnose --unpublish</code>.'), lang)}
<script type="application/json" id="report-data">${safeJson(data)}</script>
<script type="module" src="/report-page.js"></script>
</body>
</html>`;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const lang = detectLang(request);
  const explicit = url.searchParams.has('lang');
  const slug = url.searchParams.get('slug') || url.pathname.split('/case/')[1] || '';
  const entry = slug === 'demo' ? { slug: 'demo', report: DEMO_REPORT } : await loadReport(slug);
  const store = entry && getStore();
  if (store) entry.rank = await safely(() => rankFor(store, entry.report.score));
  if (!entry) {
    const fr = lang === 'fr';
    return htmlResponse(`${head({ title: fr ? 'Dossier introuvable · Claude Dependency Test' : 'Report not found · Claude Dependency Test', description: fr ? 'Ce dossier a été supprimé ou a expiré.' : 'This lab report was deleted or has expired.', image: `${url.origin}/og`, canonical: `${url.origin}/`, lang })}
  <header class="result"><p class="kicker">404</p><h1>${fr ? 'Ce dossier a quitté l\'hôpital.' : 'This lab report has left the building.'}</h1>
  <p class="lead">${fr ? 'Il a été supprimé par son patient, ou il a expiré après un an sans visite de contrôle.' : 'It was deleted by its patient, or it expired after a year without a checkup.'}</p></header>
  ${installCtaHtml(lang)}${footer('', lang)}
<script type="module" src="/report-page.js"></script>
</body></html>`, { status: 404, cache: 'no-store' });
  }
  // Short cache: an unpublished or updated case file must disappear quickly everywhere. Pages whose
  // language comes from Accept-Language stay out of the shared CDN cache (private) and say so (Vary).
  const ttl = slug === 'demo' ? 300 : 60;
  const cache = explicit ? `public, max-age=${ttl}, s-maxage=${ttl}` : `private, max-age=${ttl}`;
  return htmlResponse(renderReportPage(entry, url.origin, lang), { cache, vary: explicit ? null : 'Accept-Language' });
}
