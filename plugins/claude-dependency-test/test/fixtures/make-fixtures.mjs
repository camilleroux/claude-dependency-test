// Regenerates the synthetic transcripts in test/fixtures/basic. Run: node test/fixtures/make-fixtures.mjs
// Every line mimics the real Claude Code format, with planted secrets (prompt text, paths, project
// names) so tests can prove none of them ever reaches the output.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'basic');
const CWD = '/Users/alice/SECRET_PROJECT_NAME';
const base = (uuid, ts, sid, extra = {}) => ({
  parentUuid: null, isSidechain: false, userType: 'external', cwd: CWD, sessionId: sid,
  version: '2.1.300', gitBranch: 'SECRET_BRANCH', uuid, timestamp: ts, ...extra,
});
const prompt = (uuid, ts, sid, text = 'SECRET_PROMPT_TEXT please refactor /Users/alice/SECRET_FILE.ts') => ({
  ...base(uuid, ts, sid), type: 'user', origin: { kind: 'human' }, promptSource: 'typed', permissionMode: 'default',
  promptId: `p-${uuid}`, message: { role: 'user', content: text },
});
const toolResult = (uuid, ts, sid, extra = {}) => ({
  ...base(uuid, ts, sid, extra), type: 'user',
  message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_SECRET', content: 'SECRET_TOOL_OUTPUT', is_error: false }] },
});
const assistant = (uuid, ts, sid, id, model, block = 'text', extra = {}) => ({
  ...base(uuid, ts, sid, extra), type: 'assistant', requestId: `req_${id}`,
  message: {
    id, type: 'message', role: 'assistant', model, stop_reason: block === 'tool_use' ? 'tool_use' : 'end_turn',
    content: [block === 'tool_use' ? { type: 'tool_use', id: 'toolu_SECRET', name: 'Bash', input: { command: 'cat SECRET_FILE' } } : { type: block, [block]: 'SECRET_RESPONSE_TEXT' }],
    usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
  },
});
const rateLimit = (uuid, ts, sid, resetsAt) => ({
  ...base(uuid, ts, sid), type: 'assistant', isApiErrorMessage: true, error: 'rate_limit', apiErrorStatus: 429,
  quotaLimits: { status: 'rejected', rateLimitType: 'five_hour', resetsAt },
  message: { id: `synthetic-${uuid}`, type: 'message', role: 'assistant', model: '<synthetic>', content: [{ type: 'text', text: 'SECRET_LIMIT_TEXT' }] },
});

// Session s1: Saturday 2026-09-26 late evening, continuing past midnight into Sunday.
const s1 = [
  { type: 'file-history-snapshot', messageId: 'x', snapshot: { trackedFileBackups: { '/Users/alice/SECRET_FILE.ts': {} } } },
  prompt('u1', '2026-09-26T23:50:00.000Z', 's1'),
  assistant('a1', '2026-09-26T23:50:05.000Z', 's1', 'msg_1', 'claude-opus-5', 'thinking'),
  assistant('a2', '2026-09-26T23:50:06.000Z', 's1', 'msg_1', 'claude-opus-5', 'tool_use'), // same API response, 2nd line
  toolResult('t1', '2026-09-26T23:50:10.000Z', 's1'),
  assistant('a3', '2026-09-26T23:50:20.000Z', 's1', 'msg_2', 'claude-opus-5'),
  // 40 minutes later: new session
  prompt('u2', '2026-09-27T00:30:00.000Z', 's1'),
  assistant('a4', '2026-09-27T00:30:30.000Z', 's1', 'msg_3', 'claude-sonnet-5'),
  { ...base('u3', '2026-09-27T00:31:00.000Z', 's1'), type: 'user', isMeta: true, message: { role: 'user', content: '<local-command-caveat>SECRET</local-command-caveat>' } },
  { ...base('u4', '2026-09-27T00:32:00.000Z', 's1'), type: 'user', origin: { kind: 'task-notification' }, promptSource: 'system', message: { role: 'user', content: '<task-notification>SECRET</task-notification>' } },
  { type: 'system', subtype: 'compact_boundary', uuid: 'sys0', timestamp: '2026-09-27T00:33:00.000Z', sessionId: 's1' },
  { type: 'system', subtype: 'turn_duration', durationMs: 90_000, uuid: 'sys1', timestamp: '2026-09-27T00:31:30.000Z', sessionId: 's1' },
];
const s1Text = s1.map((o) => JSON.stringify(o)).join('\n') + '\n{"type":"user","truncated line from a crash\n';

// Session s2 resumes s1: the first lines are verbatim copies (same uuid, new sessionId).
const copy = (o) => ({ ...o, sessionId: 's2' });
const s2 = [
  copy(s1[6]), // u2
  copy(s1[7]), // a4
  prompt('u5', '2026-09-28T09:00:00.000Z', 's2'),
  assistant('a5', '2026-09-28T09:10:00.000Z', 's2', 'msg_4', 'claude-opus-5-5'),
  rateLimit('e1', '2026-09-28T09:20:00.000Z', 's2', 1790000000),
  rateLimit('e2', '2026-09-28T09:21:00.000Z', 's2', 1790000000), // same limit window: one hit
  { ...prompt('u6', '2026-09-28T09:25:00.000Z', 's2'), promptSource: 'queued' },
  assistant('a6', '2026-09-28T09:40:00.000Z', 's2', 'msg_5', 'claude-haiku-4-5-20251001'),
];

// Subagent transcript: sidechain lines count for models only.
const sub = [
  { ...base('sa1', '2026-09-28T09:05:00.000Z', 's2', { isSidechain: true, agentId: 'agent1' }), type: 'user', message: { role: 'user', content: 'SECRET_SUBAGENT_PROMPT' } },
  assistant('sa2', '2026-09-28T09:06:00.000Z', 's2', 'msg_6', 'claude-opus-5', 'text', { isSidechain: true }),
];

// Legacy transcript: no origin / promptSource fields.
const legacyUser = (uuid, ts, content) => ({ ...base(uuid, ts, 's3'), type: 'user', message: { role: 'user', content } });
const s3 = [
  legacyUser('old1', '2026-07-01T10:00:00.000Z', 'SECRET old prompt outside the retention window'),
  assistant('olda', '2026-07-01T10:00:05.000Z', 's3', 'msg_old', 'claude-opus-5'),
  legacyUser('l1', '2026-09-20T14:00:00.000Z', 'SECRET_LEGACY_PROMPT'),
  legacyUser('l2', '2026-09-20T14:00:05.000Z', '<local-command-stdout>SECRET</local-command-stdout>'),
  legacyUser('l3', '2026-09-20T14:00:06.000Z', [{ type: 'text', text: '[Request interrupted by user]' }]),
  toolResult('l4', '2026-09-20T14:00:08.000Z', 's3'),
  assistant('l5', '2026-09-20T14:00:10.000Z', 's3', 'msg_7', 'claude-sonnet-5'),
];

const write = (rel, lines) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, typeof lines === 'string' ? lines : lines.map((o) => JSON.stringify(o)).join('\n') + '\n');
};
fs.rmSync(ROOT, { recursive: true, force: true });
write('projects/-Users-alice-SECRET_PROJECT_NAME/s1.jsonl', s1Text);
write('projects/-Users-alice-SECRET_PROJECT_NAME/s2.jsonl', s2);
write('projects/-Users-alice-SECRET_PROJECT_NAME/s2/subagents/agent-agent1.jsonl', sub);
write('projects/-Users-alice-OTHER_SECRET/s3.jsonl', s3);
fs.writeFileSync(path.join(ROOT, 'settings.json'), JSON.stringify({ cleanupPeriodDays: 30, env: { SECRET_TOKEN: 'SECRET_SETTING' } }, null, 2) + '\n');
console.log('fixtures written to', ROOT);
