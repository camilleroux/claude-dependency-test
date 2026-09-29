#!/usr/bin/env node
// Claude Dependency Test: computes a 0-100 dependency score from local Claude Code transcripts.
// The computation is deterministic, offline and dependency-free. Then, unless --no-publish, the
// aggregate report (numbers and enum values only) is published to the share site.
//
// Usage: node diagnose.mjs [--json] [--tz <IANA zone>] [--days <n>] [--open] [--no-html]
//                          [--no-publish] [--new-link] [--unpublish]
//                          [--out <dir>] [--config-dir <dir>] [--now <ISO date>]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { collect } from './lib/collect.mjs';
import { computeMetrics } from './lib/metrics.mjs';
import { archetypeFor, scoreMetrics, stageFor } from './lib/score.mjs';
import { publish, unpublish } from './lib/publish.mjs';
import { buildResult, finalizeShare, renderHtml, renderShareFooter, toPublicReport } from './lib/report.mjs';
import { badgeUrl, rankText, shareText } from '../assets/card.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;

export function parseArgs(argv) {
  const args = { json: false, open: false, html: true, publish: true, newLink: false, unpublish: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${a} needs a value`);
      return argv[++i];
    };
    if (a === '--json') args.json = true;
    else if (a === '--open') args.open = true;
    else if (a === '--no-open') args.open = false;
    else if (a === '--no-html') args.html = false;
    else if (a === '--no-publish') args.publish = false;
    else if (a === '--new-link') args.newLink = true;
    else if (a === '--unpublish') args.unpublish = true;
    else if (a === '--tz') args.tz = next();
    else if (a === '--days') args.days = Number(next());
    else if (a === '--out') args.out = next();
    else if (a === '--config-dir') args.configDir = next();
    else if (a === '--now') args.now = next();
    else if (a === '--help' || a === '-h') args.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  if (args.days !== undefined && !(args.days >= 1)) throw new Error('--days must be a positive number');
  if (!argv.includes('--no-open') && !args.json && process.stdout.isTTY) args.open = true; // npx in a terminal
  if (args.tz) new Intl.DateTimeFormat('en-US', { timeZone: args.tz }); // throws on invalid zone
  return args;
}

/** Reads only `cleanupPeriodDays` from settings.json. */
export function readCleanupPeriodDays(configDir, fallback) {
  try {
    const s = JSON.parse(fs.readFileSync(path.join(configDir, 'settings.json'), 'utf8'));
    const v = Number(s && s.cleanupPeriodDays);
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

function openInBrowser(file) {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open';
  const cmdArgs = process.platform === 'win32' ? ['/c', 'start', '', file] : [file];
  try {
    spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' }).on('error', () => {}).unref();
  } catch {
    /* opening the browser is best-effort */
  }
}

export async function run(argv, env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const args = parseArgs(argv);
  if (args.help) {
    return { text: 'Usage: diagnose.mjs [--json] [--tz Europe/Paris] [--days 30] [--open] [--no-html] [--no-publish] [--new-link] [--unpublish] [--out dir]' };
  }
  const outDir = args.out || path.join(os.homedir(), '.claude-dependency-test');
  const stateFile = path.join(outDir, 'published.json');

  if (args.unpublish) {
    const r = await unpublish({ stateFile, fetchImpl });
    const result = { tool: 'claude-dependency-test', version: VERSION, unpublished: r };
    return { result, text: r.deleted ? `Deleted ${r.url}. It's gone from the database now; cached copies of the page, preview image and badge expire within 5 minutes.` : `Nothing to delete: ${r.reason}.` };
  }
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'scoring.json'), 'utf8'));
  const configDir = args.configDir || env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
  const projectsDir = path.join(configDir, 'projects');
  const timeZone = args.tz || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const now = args.now ? Date.parse(args.now) : Date.now();
  if (!Number.isFinite(now)) throw new Error('--now must be an ISO date');
  const cleanupPeriodDays = readCleanupPeriodDays(configDir, config.defaultCleanupPeriodDays);
  const baseUrl = env.CDT_SHARE_BASE_URL || config.share.baseUrl;

  const collected = await collect(projectsDir);
  const computed = computeMetrics(collected, { now, timeZone, cleanupPeriodDays, maxDays: args.days, config });

  if (computed.empty) {
    const result = {
      tool: 'claude-dependency-test',
      version: VERSION,
      error: 'insufficient_data',
      message: `No prompts found in the last ${args.days || cleanupPeriodDays} days of Claude Code transcripts. Use Claude Code a bit, then come back for your diagnosis.`,
      dataQuality: collected.quality,
    };
    return { result, text: result.message };
  }

  const scored = scoreMetrics(computed.metrics, computed.window.days, config);
  const stage = stageFor(scored.total, config);
  const archetype = archetypeFor(scored.breakdown, config);
  const result = buildResult({
    computed,
    scored,
    stage,
    archetype,
    config,
    baseUrl,
    generatedAt: new Date(now).toISOString(),
    version: VERSION,
  });
  result.dataQuality = collected.quality;

  if (args.publish && !env.CDT_NO_PUBLISH) {
    try {
      const p = await publish({ baseUrl, report: toPublicReport(result), stateFile, forceNew: args.newLink, fetchImpl });
      result.published = p;
      result.share.url = p.url;
      result.share.badge = badgeUrl(baseUrl, result.card, p.slug);
      if (p.rank) {
        // "More addicted than 72% of patients": computed by the share site from published scores.
        result.rank = { ...p.rank, text: rankText(p.rank) };
        result.share.text = shareText({ ...result.card, rank: p.rank });
      }
      finalizeShare(result);
    } catch (err) {
      result.publishError = `${err.message}. Falling back to a link that carries the card in its URL.`;
    }
  }

  if (args.html) {
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, 'report.html');
    fs.writeFileSync(file, renderHtml(result));
    result.reportPath = file;
  }
  if (args.open && !env.CDT_NO_OPEN) {
    const target = result.published ? result.published.url : result.reportPath;
    if (target) openInBrowser(target);
  }
  const lines = [result.bulletin, ''];
  if (result.published) {
    if (result.rank) lines.push(`  ${result.rank.text} (${result.rank.total} diagnosed so far).`);
    lines.push(`  Online: ${result.published.url}${result.published.updated ? ' (updated)' : ''}`);
    lines.push('  Only aggregate numbers were published. Delete it: --unpublish · Stay offline next time: --no-publish');
  }
  else if (result.publishError) lines.push(`  Not published: ${result.publishError}`);
  lines.push(`  Card:   ${result.reportPath || '(not written)'}`, renderShareFooter(result), '');
  return { result, text: lines.join('\n') };
}

// npx and global installs run this file through a symlink (node_modules/.bin), so compare real paths.
const realpath = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const isMain = process.argv[1] && realpath(process.argv[1]) === realpath(fileURLToPath(import.meta.url));
if (isMain) {
  run(process.argv.slice(2))
    .then(({ result, text }) => {
      const argv = process.argv.slice(2);
      process.stdout.write(argv.includes('--json') && result ? `${JSON.stringify(result, null, 1)}\n` : `${text}\n`);
    })
    .catch((err) => {
      process.stderr.write(`claude-dependency-test: ${err.message}\n`);
      process.exit(1);
    });
}
