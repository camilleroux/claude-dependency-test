// Streams Claude Code transcripts and keeps only timestamps and a few enum-like fields.
// Message text, file paths, project names and identifiers are never stored or returned:
// uuids / message ids live only in in-memory Sets used for de-duplication.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { normalizeToolName } from '../../assets/card.js';

// Legacy transcripts (written before Claude Code tagged prompts with `origin`/`promptSource`)
// have no structured marker for "typed by a human". For those lines only, we compare the first
// characters of the text against this fixed list of tags that Claude Code itself injects.
// The text is never copied or kept.
const LEGACY_INJECTED_PREFIXES = ['<', '[Request interrupted'];
const HUMAN_PROMPT_SOURCES = new Set(['typed', 'queued', 'suggestion_accepted']);

export function listTranscriptFiles(projectsDir) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && e.name.endsWith('.jsonl')) out.push(p);
    }
  };
  walk(projectsDir);
  return out.sort();
}

function leadingText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const block = content.find((b) => b && b.type === 'text');
    return block && typeof block.text === 'string' ? block.text : '';
  }
  return '';
}

/** Returns 'human' | 'legacy-human' | null for a `type: "user"` line. */
export function classifyUserLine(o) {
  if (o.isSidechain || o.isMeta || o.isCompactSummary || o.isVisibleInTranscriptOnly) return null;
  const content = o.message && o.message.content;
  if (Array.isArray(content)) {
    if (content.some((b) => b && b.type === 'tool_result')) return null;
    if (!content.some((b) => b && (b.type === 'text' || b.type === 'image'))) return null;
  } else if (typeof content !== 'string') {
    return null;
  }
  if (o.origin && typeof o.origin === 'object') return o.origin.kind === 'human' ? 'human' : null;
  if (typeof o.promptSource === 'string') return HUMAN_PROMPT_SOURCES.has(o.promptSource) ? 'human' : null;
  const head = leadingText(content).slice(0, 32).trimStart();
  if (!head) return Array.isArray(content) ? 'legacy-human' : null; // image-only prompt
  if (LEGACY_INJECTED_PREFIXES.some((p) => head.startsWith(p))) return null;
  return 'legacy-human';
}

// Claude Code writes this marker (not a prompt) when you press Esc while Claude is working.
const INTERRUPTION_MARKER = '[Request interrupted';
function isInterruptionLine(o) {
  if (o.isSidechain || o.origin || o.promptSource) return false;
  const content = o.message && o.message.content;
  const block = Array.isArray(content) && content.length === 1 && content[0] && content[0].type === 'text' ? content[0] : null;
  return !!block && typeof block.text === 'string' && block.text.startsWith(INTERRUPTION_MARKER);
}

function isRateLimitLine(o) {
  if (o.error === 'rate_limit') return true;
  return !!(o.quotaLimits && o.quotaLimits.status === 'rejected');
}

/**
 * @returns {Promise<{
 *   activity: number[], prompts: number[], modelEvents: {ms:number, model:string}[],
 *   limitEvents: {ms:number, resetsAt:number|null}[], errorSignalsSeen: boolean,
 *   quality: object }>}
 */
export async function collect(projectsDir) {
  const files = listTranscriptFiles(projectsDir);
  const seenUuids = new Set();
  const seenMessageIds = new Set();
  const activity = [];
  const prompts = [];
  const modelEvents = [];
  const limitEvents = [];
  const toolEvents = []; // { ms, name } with name from a fixed list (see normalizeToolName)
  const usageById = new Map(); // message.id -> { ms, out, total }: max over the lines of one response
  const subagents = new Map(); // agentId -> first ms (ids stay in memory, only the count is output)
  const compactions = [];
  const turns = []; // { ms, durationMs } for main-thread turns
  const interruptions = [];
  const projectLastMs = new Map(); // transcript folder -> last activity (only the count is output)
  let errorSignalsSeen = false;
  const quality = {
    files: files.length,
    lines: 0,
    unparseableLines: 0,
    duplicateLinesSkipped: 0,
    promptsFromOriginField: 0,
    promptsFromLegacyHeuristic: 0,
  };

  for (const file of files) {
    const project = path.relative(projectsDir, file).split(path.sep)[0];
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity });
    for await (const line of rl) {
      if (!line) continue;
      quality.lines++;
      let o;
      try {
        o = JSON.parse(line);
      } catch {
        quality.unparseableLines++;
        continue;
      }
      if (!o || (o.type !== 'user' && o.type !== 'assistant' && o.type !== 'system')) continue;

      // Resumed / forked sessions copy earlier lines verbatim (same uuid) into a new file.
      if (typeof o.uuid === 'string') {
        if (seenUuids.has(o.uuid)) {
          quality.duplicateLinesSkipped++;
          continue;
        }
        seenUuids.add(o.uuid);
      }
      const ms = Date.parse(o.timestamp);
      if (!Number.isFinite(ms)) continue;

      if (o.type === 'system') {
        if (o.isSidechain) continue;
        if (o.subtype === 'compact_boundary') compactions.push(ms);
        if (o.subtype === 'turn_duration' && Number.isFinite(o.durationMs) && o.durationMs > 0) turns.push({ ms, durationMs: o.durationMs });
        continue;
      }
      if (o.isSidechain && typeof o.agentId === 'string' && !subagents.has(o.agentId)) subagents.set(o.agentId, ms);

      if (o.type === 'assistant') {
        if (o.error !== undefined || o.quotaLimits || o.isApiErrorMessage) errorSignalsSeen = true;
        if (isRateLimitLine(o)) {
          const r = o.quotaLimits && Number(o.quotaLimits.resetsAt);
          limitEvents.push({ ms, resetsAt: Number.isFinite(r) ? r : null });
        }
        // One API response is written as several lines sharing message.id: count it once.
        const msg = o.message || {};
        const model = typeof msg.model === 'string' ? msg.model : null;
        const id = typeof msg.id === 'string' ? msg.id : null;
        if (model && model !== '<synthetic>' && !o.isApiErrorMessage && (!id || !seenMessageIds.has(id))) {
          if (id) seenMessageIds.add(id);
          modelEvents.push({ ms, model });
        }
        if (Array.isArray(msg.content)) {
          for (const b of msg.content) if (b && b.type === 'tool_use' && typeof b.name === 'string') toolEvents.push({ ms, name: normalizeToolName(b.name) });
        }
        const u = msg.usage;
        if (id && u && !o.isApiErrorMessage) {
          const n = (v) => (Number.isFinite(v) && v > 0 ? v : 0);
          const out = n(u.output_tokens);
          const total = out + n(u.input_tokens) + n(u.cache_read_input_tokens) + n(u.cache_creation_input_tokens);
          const prev = usageById.get(id);
          if (!prev) usageById.set(id, { ms, out, total });
          else {
            prev.out = Math.max(prev.out, out);
            prev.total = Math.max(prev.total, total);
          }
        }
      }

      if (o.isSidechain) continue; // subagent work counts for models, tools and tokens, not activity or prompts
      activity.push(ms);
      projectLastMs.set(project, Math.max(projectLastMs.get(project) || 0, ms));
      if (o.type === 'user' && isInterruptionLine(o)) interruptions.push(ms);

      if (o.type === 'user') {
        const kind = classifyUserLine(o);
        if (kind) {
          prompts.push(ms);
          if (kind === 'human') quality.promptsFromOriginField++;
          else quality.promptsFromLegacyHeuristic++;
        }
      }
    }
  }

  activity.sort((a, b) => a - b);
  prompts.sort((a, b) => a - b);
  limitEvents.sort((a, b) => a.ms - b.ms);
  return {
    activity,
    prompts,
    modelEvents,
    limitEvents,
    errorSignalsSeen,
    toolEvents,
    usageEvents: [...usageById.values()],
    subagentStarts: [...subagents.values()],
    compactions,
    turns,
    interruptions,
    projectLastActivity: [...projectLastMs.values()],
    quality,
  };
}
