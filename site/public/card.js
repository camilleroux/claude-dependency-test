// Claude Dependency Test: shared card model + renderer.
// Plain ES module with no dependencies. Used by the Node script (share URL), the local
// report.html (inlined) and the website (served as /card.js). Keep it DOM-free at top level.
// The site keeps a byte-identical copy in site/public/card.js (npm run sync-card).

export const CARD_VERSION = 1;
export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export const STAGES = {
  1: { name: 'Casual User', prognosis: 'Healthy relationship detected. Suspiciously healthy. Monitor for relapse.' },
  2: { name: 'Regular', prognosis: 'Mild attachment. Patient can still write a regex unassisted, on a good day.' },
  3: { name: 'Dependent', prognosis: 'Patient says "let me just ask Claude" several times a day. Stable, cheerful.' },
  4: { name: 'Chronic', prognosis: 'The terminal tab is never closed. Prognosis: alarmingly productive.' },
  5: { name: 'Terminal', prognosis: 'Patient lives in the terminal. Literally. No known cure, no regrets.' },
};

// "Archetypes" are fake medical conditions, each with a made-up diagnostic code.
// (The field is still called `archetype` in data and URLs.)
export const STAGES_FR = {
  1: { name: 'Usage occasionnel', prognosis: 'Relation saine détectée. Étrangement saine. Surveiller les rechutes.' },
  2: { name: 'Régulier', prognosis: "Attachement léger. Le patient sait encore écrire une regex seul, les bons jours." },
  3: { name: 'Dépendant', prognosis: "Le patient dit « je demande à Claude » plusieurs fois par jour. Stable, de bonne humeur." },
  4: { name: 'Chronique', prognosis: "L'onglet du terminal ne se ferme jamais. Pronostic : productivité alarmante." },
  5: { name: 'Terminal', prognosis: 'Le patient vit dans le terminal. Littéralement. Aucun remède connu, aucun regret.' },
};

export const ARCHETYPES_FR = {
  'recreational-use': { name: 'Usage récréatif', tagline: "Consomme Claude en société. Peut arrêter quand il veut. En théorie.", alarm: '● STABLE' },
  'deep-focus': { name: 'Syndrome de concentration profonde chronique', tagline: 'Des sessions si longues qu\'elles mériteraient un entracte.', alarm: '▲ SESSIONS LONGUES' },
  'streak-dependency': { name: 'Syndrome de dépendance à la série', tagline: "N'a pas manqué un seul jour. Claude a maintenant les clés de l'appartement.", alarm: '▲ SÉRIE ÉLEVÉE' },
  'session-overextension': { name: 'Trouble de la session à rallonge', tagline: 'Les sessions se terminent quand la batterie du portable lâche.', alarm: '▲ SESSION TROP LONGUE' },
  'middle-manager': { name: 'Syndrome du manager intermédiaire', tagline: "Dirige une équipe d'IA. N'a jamais rencontré aucun de ses membres.", alarm: '▲ EFFECTIF ÉLEVÉ' },
  'hypergraphia': { name: 'Hypergraphie par procuration', tagline: 'Claude écrit un roman par jour pour ce patient.', alarm: '▲ PRODUCTION ÉLEVÉE' },
  'prompt-hyperactivity': { name: "Trouble de l'hyperactivité promptique", tagline: 'Tape plus vite que Claude ne dit « Vous avez tout à fait raison ».', alarm: '▲ DÉBIT DE PROMPTS ÉLEVÉ' },
  'limit-collision': { name: 'Collision chronique avec la limite', tagline: "Tutoie l'écran de limite d'usage.", alarm: '▲ LIMITE ATTEINTE' },
  'opus-affluenza': { name: 'Affluenza Opus', tagline: 'Seul le meilleur modèle fera l\'affaire.', alarm: '▲ DOSE D\'OPUS ÉLEVÉE' },
};

export const ARCHETYPES = {
  'recreational-use': { name: 'Recreational Use', code: 'CDT-00.1', tagline: 'Takes Claude socially. Can stop anytime. Probably.', emoji: '🍵', alarm: '● STABLE' },
  'deep-focus': { name: 'Chronic Deep-Focus Syndrome', code: 'CDT-25.7', tagline: 'Sessions so long they need an intermission.', emoji: '⏳', alarm: '▲ SESSION LENGTH HIGH' },
  'streak-dependency': { name: 'Streak Dependency Syndrome', code: 'CDT-20.4', tagline: 'Has not missed a day. Claude now has a key to the apartment.', emoji: '🔥', alarm: '▲ STREAK HIGH' },
  'session-overextension': { name: 'Session Overextension Disorder', code: 'CDT-10.2', tagline: 'Sessions end when the laptop battery does.', emoji: '🔋', alarm: '▲ SESSION TOO LONG' },
  'middle-manager': { name: 'Middle-Manager Syndrome', code: 'CDT-10.6', tagline: 'Manages a team of AIs. Has never met any of them.', emoji: '🧑‍💼', alarm: '▲ HEADCOUNT HIGH' },
  'hypergraphia': { name: 'Hypergraphia by Proxy', code: 'CDT-10.9', tagline: 'Claude writes a novel a day for this patient.', emoji: '📚', alarm: '▲ OUTPUT HIGH' },
  'prompt-hyperactivity': { name: 'Prompt Hyperactivity Disorder', code: 'CDT-15.9', tagline: 'Types faster than Claude can say "You\'re absolutely right".', emoji: '⚡', alarm: '▲ PROMPT RATE HIGH' },
  'limit-collision': { name: 'Chronic Limit Collision', code: 'CDT-10.8', tagline: 'On a first-name basis with the usage limit screen.', emoji: '🚧', alarm: '▲ LIMIT REACHED' },
  'opus-affluenza': { name: 'Opus Affluenza', code: 'CDT-05.5', tagline: 'Only the finest model will do.', emoji: '🍷', alarm: '▲ OPUS DOSE HIGH' },
};

// Symptom keys used in share URLs, in canonical display order.
// `criterion` links a symptom to the scoring criterion it illustrates.
export const SYMPTOMS = [
  { key: 'h', criterion: 'hours', label: 'Active hours / active day', max: 24, decimals: 1, fmt: (s) => `${s.h.toFixed(1)} h` },
  { key: 'ad', criterion: 'presence', label: 'Days active', max: 100, fmt: (s) => (s.sk != null ? `${s.ad}% · ${s.sk}-day streak` : `${s.ad}%`) },
  { key: 'sk', criterion: 'streak', max: 3650, hidden: true },
  { key: 'n', criterion: 'night', label: 'Prompts between 0-5 AM', max: 100, fmt: (s) => `${s.n}%` },
  { key: 'p', criterion: 'intensity', label: 'Prompts / active day', max: 100000, fmt: (s) => `${s.p}` },
  { key: 'w', criterion: 'weekend', label: 'Weekend activity', max: 100, fmt: (s) => `${s.w}%` },
  { key: 'l', criterion: 'limits', label: 'Usage limits hit', max: 10000, fmt: (s) => `${s.l}×` },
  { key: 'ls', criterion: 'marathon', label: 'Longest session', max: 240, decimals: 1, fmt: (s) => `${s.ls.toFixed(1)} h` },
  { key: 'sa', criterion: 'delegation', label: 'Subagents hired', max: 1000000, fmt: (s) => `${s.sa}` },
  { key: 'wd', criterion: 'output', label: 'Words by Claude / day', max: 100000000, fmt: (s) => compact(s.wd) },
  { key: 'o', criterion: 'opus', label: 'Opus share', max: 100, fmt: (s) => `${s.o}%` },
];

const intIn = (raw, lo, hi) => {
  if (raw == null || !/^\d{1,9}$/.test(raw)) return null;
  const n = Number(raw);
  return n >= lo && n <= hi ? n : null;
};
const decIn = (raw, lo, hi) => {
  if (raw == null || !/^\d{1,3}(\.\d)?$/.test(raw)) return null;
  const n = Number(raw);
  return n >= lo && n <= hi ? n : null;
};

/** card: { score, stage, archetype, days, sym: { h?, ad?, sk?, n?, p?, w?, l?, o? } } */
export function encodeCard(card) {
  const q = new URLSearchParams();
  q.set('s', String(card.score));
  q.set('st', String(card.stage));
  q.set('a', card.archetype);
  if (card.days) q.set('d', String(card.days));
  for (const def of SYMPTOMS) {
    const v = card.sym[def.key];
    if (v == null) continue;
    q.set(def.key, def.decimals ? v.toFixed(def.decimals) : String(Math.round(v)));
  }
  q.set('v', String(CARD_VERSION));
  return q.toString();
}

/** Strict parser for untrusted query strings. Returns null when the core fields are invalid. */
export function decodeCard(search) {
  const q = new URLSearchParams(search);
  const score = intIn(q.get('s'), 0, 100);
  const stage = intIn(q.get('st'), 1, 5);
  const archetype = q.get('a');
  if (score == null || stage == null || !Object.prototype.hasOwnProperty.call(ARCHETYPES, archetype)) return null;
  const sym = {};
  for (const def of SYMPTOMS) {
    const v = def.decimals ? decIn(q.get(def.key), 0, def.max) : intIn(q.get(def.key), 0, def.max);
    if (v != null) sym[def.key] = v;
  }
  return { score, stage, archetype, days: intIn(q.get('d'), 1, 3650), sym };
}

export function symptomRows(card) {
  return SYMPTOMS.filter((d) => !d.hidden && card.sym[d.key] != null).map((d) => ({ key: d.key, label: d.label, value: d.fmt(card.sym) }));
}

export function shareUrl(baseUrl, card) {
  return `${String(baseUrl).replace(/\/+$/, '')}/r?${encodeCard(card)}`;
}

export function shareText(card, lang = 'en') {
  if (lang === 'fr') {
    const st = STAGES_FR[card.stage];
    const ar = ARCHETYPES_FR[card.archetype];
    return `Je viens de passer le Claude Dependency Test : ${card.score}/100, stade ${card.stage} (${st.name.toLowerCase()}).\nDiagnostic : ${ar.name} ${ARCHETYPES[card.archetype].emoji}\nEt toi, à quel point es-tu accro à Claude ?`;
  }
  const st = STAGES[card.stage];
  const ar = ARCHETYPES[card.archetype];
  return `Just got my Claude Dependency Test results: ${card.score}/100, Stage ${card.stage} (${st.name}).\nDiagnosis: ${ar.name} ${ar.emoji}\nHow addicted to Claude are you?`;
}

/** One-click share links. `via` credits the author: X shows "via @…" and suggests following. */
export function shareIntents(url, text, via = {}) {
  const e = encodeURIComponent;
  const credit = (h) => (h ? `\nvia @${h}` : '');
  const x = `https://x.com/intent/tweet?text=${e(text)}&url=${e(url)}${via.x ? `&via=${e(via.x)}&related=${e(via.x)}` : ''}`;
  return {
    x,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${e(url)}`,
    bluesky: `https://bsky.app/intent/compose?text=${e(`${text}\n${url}${credit(via.bluesky)}`)}`,
    // Mastodon has no single share URL (every instance differs): Toot asks for your instance.
    mastodon: `https://toot.kytta.dev/?text=${e(`${text}\n${url}${credit(via.mastodon)}`)}`,
  };
}

/** With a slug, the badge follows the published page and always shows the latest score. */
export function badgeUrl(baseUrl, card, slug) {
  const base = String(baseUrl).replace(/\/+$/, '');
  return slug ? `${base}/badge/${slug}` : `${base}/badge?s=${card.score}&st=${card.stage}`;
}

// ---------------------------------------------------------------------------
// Usage stats: real numbers, fun framing.

// Built-in Claude Code tools that may appear in a published report. MCP tools are grouped
// under "mcp" (no server names), anything else under "other".
export const TOOL_NAMES = [
  'Bash', 'Read', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Grep', 'Glob', 'Agent', 'WebFetch', 'WebSearch',
  'TodoWrite', 'AskUserQuestion', 'ToolSearch', 'Skill', 'ExitPlanMode', 'Monitor', 'Workflow', 'mcp', 'other',
];
export function normalizeToolName(name) {
  if (name.startsWith('mcp__')) return 'mcp';
  if (name === 'Task') return 'Agent';
  return TOOL_NAMES.includes(name) ? name : 'other';
}

// Reference sizes for comparisons (word counts of the books; 1 token ≈ 0.75 English words).
export const WORDS_PER_TOKEN = 0.75;
export const WAR_AND_PEACE_WORDS = 587_287;
const HARRY_POTTER_SERIES_TOKENS = 1_084_170 / WORDS_PER_TOKEN;

export function compact(n, lang = 'en') {
  const fr = lang === 'fr';
  const d = (x, digits) => (fr ? x.toFixed(digits).replace('.', ',') : x.toFixed(digits));
  if (n >= 1e9) return `${d(n / 1e9, n >= 1e10 ? 0 : 1)}${fr ? ' Md' : 'B'}`;
  if (n >= 1e6) return `${d(n / 1e6, n >= 1e7 ? 0 : 1)}${fr ? ' M' : 'M'}`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}${fr ? ' k' : 'K'}`;
  return Math.round(n).toLocaleString(fr ? 'fr-FR' : 'en-US');
}
export const formatMinuteOfDay = (m, lang = 'en') =>
  lang === 'fr' ? `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}` : `${formatHour(Math.floor(m / 60)).replace(' ', `:${String(m % 60).padStart(2, '0')} `)}`;
const duration = (min) => (min >= 60 ? `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')} min` : `${Math.round(min)} min`);
const times = (n, lang = 'en') => (n >= 10 ? `${Math.round(n)}×` : `${lang === 'fr' ? n.toFixed(1).replace('.', ',') : n.toFixed(1)}×`);

/** Fun facts built only from real numbers. Returns [{ key, value, label, caption }]. */
export function usageFacts(u, lang = 'en') {
  if (!u) return [];
  const fr = lang === 'fr';
  const c = (n) => compact(n, lang);
  const t = u.toolCalls || {};
  const f = [];
  const add = (key, value, label, caption) => f.push({ key, value, label, caption });
  if (u.outputTokens > 0) {
    const words = u.outputTokens * WORDS_PER_TOKEN;
    const x = times(words / WAR_AND_PEACE_WORDS, lang);
    add('words', c(words), fr ? 'mots écrits par Claude' : 'words written by Claude', fr ? `Environ ${x} Guerre et Paix (réflexion comprise).` : `About ${x} War and Peace (thinking included).`);
  }
  if (u.totalTokens > 0) {
    const x = c(u.totalTokens / HARRY_POTTER_SERIES_TOKENS);
    add('tokens', c(u.totalTokens), fr ? 'tokens traités' : 'tokens processed', fr ? `Comme relire toute la saga Harry Potter ${x} fois.` : `Like re-reading the whole Harry Potter saga ${x} times.`);
  }
  if (t.Bash) add('bash', c(t.Bash), fr ? 'commandes shell lancées' : 'shell commands run', fr ? "Ton terminal n'a jamais autant travaillé." : 'Your terminal has never been this busy.');
  const edits = (t.Edit || 0) + (t.MultiEdit || 0) + (t.Write || 0) + (t.NotebookEdit || 0);
  if (t.Read || edits) add('files', `${c(t.Read || 0)} / ${c(edits)}`, fr ? 'lectures / modifications de fichiers' : 'file reads / edits', fr ? "On lit d'abord, on modifie ensuite. En général." : 'Reads first, edits later. Mostly.');
  if (u.subagents) add('subagents', c(u.subagents), fr ? 'sous-agents engagés' : 'subagents hired', fr ? 'Claude délègue, comme un vrai manager.' : 'Claude delegates, like a real manager.');
  if (u.longestTurnMinutes >= 1) add('longest-turn', duration(u.longestTurnMinutes), fr ? 'plus long travail de Claude en solo' : 'longest solo run by Claude', fr ? 'Sur une seule demande, sans toi.' : 'On a single request, without you.');
  if (u.claudeHours >= 1) add('claude-hours', `${c(u.claudeHours)} h`, fr ? 'de Claude au travail pour toi' : 'of Claude working on your requests', fr ? 'Du prompt à la réponse finale de Claude, additionné.' : "Timed from each prompt to Claude's final answer.");
  const one = u.interruptions === 1;
  add('interruptions', c(u.interruptions),
    fr ? `fois où tu as arrêté Claude avec Échap` : `time${one ? '' : 's'} you hit Esc on Claude`,
    u.interruptions === 0 ? (fr ? 'Patience de saint.' : 'Saintly patience.') : u.interruptions > 30 ? (fr ? 'Brutal, mais efficace.' : 'Rude, but efficient.') : (fr ? 'Seulement quand il le fallait.' : 'Only when it mattered.'));
  if (u.compactions) add('compactions', c(u.compactions), fr ? `débordement${u.compactions === 1 ? '' : 's'} de contexte` : `context overflow${u.compactions === 1 ? '' : 's'}`, fr ? 'Des conversations si longues que Claude a dû les résumer.' : 'Conversations so long Claude had to summarize them.');
  if (u.projects) add('projects', c(u.projects), fr ? `projet${u.projects === 1 ? '' : 's'} en cours` : `project${u.projects === 1 ? '' : 's'} on the go`, u.projects > 10 ? (fr ? 'La concentration, c\'est surfait.' : 'Focus is overrated.') : (fr ? 'Un portefeuille raisonnable.' : 'A reasonable portfolio.'));
  const web = (t.WebSearch || 0) + (t.WebFetch || 0);
  if (web) add('web', c(web), fr ? 'recherches et pages web consultées' : 'web searches and page fetches', fr ? 'Claude cherche sur le web pour que tu n\'aies pas à le faire.' : "Claude googles so you don't have to.");
  if (t.mcp) add('mcp', c(t.mcp), fr ? 'appels d\'outils MCP' : 'MCP tool calls', fr ? 'Branché sur tout.' : 'Plugged into everything.');
  if (u.latestNightMinute != null) add('bedtime', formatMinuteOfDay(u.latestNightMinute, lang), fr ? 'dernier prompt de la journée' : 'latest prompt of the day', fr ? 'Les bonnes idées ont leurs propres horaires.' : 'Good ideas keep their own hours.');
  if (u.earliestMorningMinute != null) add('early', formatMinuteOfDay(u.earliestMorningMinute, lang), fr ? 'premier prompt de la journée' : 'earliest start of the day', fr ? "Le premier prompt d'une longue journée." : 'The first prompt of a long day.');
  return f;
}

/**
 * The most spectacular numbers, ranked by a "wow" ratio (value ÷ a reference an ordinary user
 * rarely reaches). Input: { usage, sample, extras: { currentStreak, longestSessionHours, busiestDay } }.
 * Returns [{ key, label, value, hint, color, wow, line }], most spectacular first.
 */
export function headlines(r, limit = 5, lang = 'en') {
  const u = r.usage || {};
  const t = u.toolCalls || {};
  const e = r.extras || {};
  const books = ((u.outputTokens || 0) * WORDS_PER_TOKEN) / WAR_AND_PEACE_WORDS;
  const dur = (min) => (min >= 60 ? `${Math.floor(min / 60)} H ${String(Math.round(min % 60)).padStart(2, '0')}` : `${Math.round(min)} MIN`);
  const fr = lang === 'fr';
  const c = (n) => compact(n, lang);
  const busiest = e.busiestDay && e.busiestDay.day
    ? new Date(`${e.busiestDay.day}T12:00:00Z`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    : '';
  const bookCount = books >= 10 ? Math.round(books) : fr ? books.toFixed(1).replace('.', ',') : books.toFixed(1);
  const h = (x) => (fr ? `${c(x)} H` : `${c(x)} H`);
  // label: what it is, in plain words · value: the number with its unit · hint: one line of context
  const list = [
    { key: 'words', raw: books, ref: 3, label: fr ? 'MOTS ÉCRITS PAR CLAUDE' : 'WORDS WRITTEN BY CLAUDE', value: c((u.outputTokens || 0) * WORDS_PER_TOKEN), hint: fr ? `Environ ${bookCount} exemplaires de Guerre et Paix, réflexion comprise` : `About ${bookCount} copies of War and Peace, thinking included`, color: 'cyan' },
    { key: 'solo', raw: u.longestTurnMinutes || 0, ref: 90, label: fr ? 'PLUS LONG TRAVAIL SANS TOI' : 'LONGEST RUN WITHOUT YOU', value: dur(u.longestTurnMinutes || 0), hint: fr ? 'Claude seul, sur une seule demande' : 'Claude working alone on a single request', color: 'amber' },
    { key: 'subagents', raw: u.subagents || 0, ref: 40, label: fr ? 'SOUS-AGENTS LANCÉS' : 'SUBAGENTS LAUNCHED', value: c(u.subagents || 0), hint: fr ? 'Des agents assistants lancés par Claude pour répartir le travail' : 'Helper agents Claude started to split the work', color: 'amber' },
    { key: 'session', raw: e.longestSessionHours || 0, ref: 3, label: fr ? 'PLUS LONGUE SESSION' : 'LONGEST SESSION', value: `${fr ? (e.longestSessionHours || 0).toFixed(1).replace('.', ',') : (e.longestSessionHours || 0).toFixed(1)} H`, hint: fr ? 'Avec Claude, sans pause de 30 minutes' : 'With Claude, without a 30-minute break', color: 'magenta' },
    { key: 'streak', raw: e.currentStreak || 0, ref: 10, label: fr ? "JOURS D'AFFILÉE" : 'DAYS IN A ROW', value: `${e.currentStreak || 0}`, hint: fr ? 'Série en cours, au moins un prompt par jour' : 'Current streak, at least one prompt a day', color: 'amber' },
    { key: 'binge', raw: (e.busiestDay && e.busiestDay.prompts) || 0, ref: 120, label: fr ? 'PROMPTS EN UNE JOURNÉE' : 'PROMPTS IN ONE DAY', value: c((e.busiestDay && e.busiestDay.prompts) || 0), hint: busiest ? (fr ? `Ta journée la plus chargée, le ${busiest}` : `Your busiest day, ${busiest}`) : fr ? 'Ta journée la plus chargée' : 'Your busiest day', color: 'ph' },
    { key: 'bash', raw: t.Bash || 0, ref: 2500, label: fr ? 'COMMANDES TERMINAL' : 'TERMINAL COMMANDS', value: c(t.Bash || 0), hint: fr ? 'Commandes shell lancées par Claude pour toi' : 'Shell commands Claude ran for you', color: 'ph' },
    { key: 'claude-hours', raw: u.claudeHours || 0, ref: 40, label: fr ? 'HEURES DE CLAUDE AU TRAVAIL' : 'HOURS OF CLAUDE AT WORK', value: h(u.claudeHours || 0), hint: fr ? 'Du prompt à la réponse finale de Claude, additionné' : "From each prompt to Claude's final answer, added up", color: 'cyan' },
    { key: 'esc', raw: u.interruptions || 0, ref: 40, label: fr ? 'FOIS OÙ TU AS ARRÊTÉ CLAUDE' : 'TIMES YOU STOPPED CLAUDE', value: c(u.interruptions || 0), hint: fr ? 'Échap pressé pendant que Claude travaillait' : 'Esc pressed while Claude was working', color: 'magenta' },
    { key: 'tokens', raw: u.totalTokens || 0, ref: 2e9, label: fr ? 'TOKENS TRAITÉS' : 'TOKENS PROCESSED', value: c(u.totalTokens || 0), hint: fr ? 'Surtout du contexte relu par Claude depuis son cache' : 'Mostly context Claude re-read from its cache', color: 'cyan' },
  ];


  return list
    .filter((h) => h.raw > 0)
    .map(({ raw, ref, ...h }) => ({ ...h, wow: raw / ref, line: `${h.value.toLowerCase()} ${h.label.toLowerCase()}: ${h.hint.toLowerCase()}` }))
    .sort((a, b) => b.wow - a.wow)
    .slice(0, limit);
}

/** Tool usage sorted by count, for charts. */
export function topTools(u, limit = 8) {
  return Object.entries((u && u.toolCalls) || {})
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Published report: the aggregate payload sent to the share site when you publish.
// Numbers and enum values only. No free text can be published, so a page on the share
// site can never contain prompts, paths, names or anything a user typed.

export const REPORT_VERSION = 1;

export const CRITERIA = {
  hours: 'Active hours per active day',
  streak: 'Longest streak',
  presence: 'Presence',
  intensity: 'Intensity',
  marathon: 'Marathon',
  delegation: 'Delegation',
  output: 'Output',
  limits: 'Usage limits hit',
  opus: 'Opus share',
};

const pct = (v) => `${Math.round(v * 100)}%`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
export const METRICS = {
  activeHoursPerActiveDay: { label: 'Active hours / active day', value: (v) => `${v.toFixed(1)} h`, ref: (a, b) => `${a}-${b} h` },
  activeDaysShare: { label: 'Days active', value: pct, ref: (a, b) => `${pct(a)}-${pct(b)}` },
  longestStreakDays: { label: 'Longest streak', value: (v) => plural(v, 'day'), ref: (a, b) => `${a}-${b} d` },
  nightPromptShare: { label: 'Prompts 00:00-05:00', value: pct, ref: (a, b) => `${pct(a)}-${pct(b)}` },
  promptsPerActiveDay: { label: 'Prompts / active day', value: (v) => Math.round(v).toLocaleString('en-US'), ref: (a, b) => `${a}-${b}` },
  weekendActivityShare: { label: 'Weekend activity', value: pct, ref: (a, b) => `${pct(a)}-${pct(b)}` },
  limitHitsPer30Days: { label: 'Usage limits hit / 30 d', value: (v) => v.toFixed(1), ref: (a, b) => `${a}-${b}` },
  opusShare: { label: 'Opus share', value: pct, ref: (a, b) => `${pct(a)}-${pct(b)}` },
  longestSessionHours: { label: 'Longest session', value: (v) => `${v.toFixed(1)} h`, ref: (a, b) => `${a}-${b} h` },
  subagentsPerActiveDay: { label: 'Subagents / active day', value: (v) => v.toFixed(1), ref: (a, b) => `${a}-${b}` },
  wordsPerActiveDay: { label: 'Claude words / day', value: (v) => compact(v), ref: (a, b) => `${compact(a)}-${compact(b)}` },
};

export const MODEL_FAMILIES = ['opus', 'fable', 'sonnet', 'haiku', 'other'];
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
export const weekdays = (lang = 'en') => (lang === 'fr' ? WEEKDAYS_FR : WEEKDAYS);

export const CRITERIA_FR = {
  hours: 'Heures actives par jour actif',
  streak: 'Plus longue série',
  presence: 'Présence',
  intensity: 'Intensité',
  marathon: 'Marathon',
  delegation: 'Délégation',
  output: 'Production',
  limits: "Limites d'usage atteintes",
  opus: "Part d'Opus",
};
export const METRIC_LABELS_FR = {
  activeHoursPerActiveDay: 'Heures actives / jour actif',
  activeDaysShare: 'Jours actifs',
  longestStreakDays: 'Plus longue série',
  nightPromptShare: 'Prompts 0 h-5 h',
  promptsPerActiveDay: 'Prompts / jour actif',
  weekendActivityShare: 'Activité le week-end',
  limitHitsPer30Days: 'Limites atteintes / 30 j',
  opusShare: "Part d'Opus",
  longestSessionHours: 'Plus longue session',
  subagentsPerActiveDay: 'Sous-agents / jour actif',
  wordsPerActiveDay: 'Mots de Claude / jour',
};

export function formatHour(h, lang = 'en') {
  if (lang === 'fr') return `${h} h`;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? 'AM' : 'PM'}`;
}

/** Flag printed next to a criterion, like a lab report. */
export function severityFlag(ratio) {
  if (ratio >= 0.75) return 'HIGH';
  if (ratio >= 0.4) return 'ELEV';
  return '';
}

const MAX_COUNT = 10_000_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
class Invalid extends Error {}
const fail = (what) => { throw new Invalid(what); };
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
const int = (v, lo, hi, what) => (Number.isInteger(v) && v >= lo && v <= hi ? v : fail(what));
const num = (v, lo, hi, what) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 1000) / 1000 : fail(what));
const day = (v, what) => (typeof v === 'string' && DAY_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : fail(what));
const oneOf = (v, set, what) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(set, v) ? v : fail(what));
const ints = (a, len, what) => (Array.isArray(a) && a.length === len ? a.map((v) => int(v, 0, MAX_COUNT, what)) : fail(what));

/**
 * Validates an untrusted report and rebuilds it from known fields only.
 * Returns { report } or { error }. Unknown keys are dropped; any invalid value rejects the whole report.
 */
export function sanitizeReport(input) {
  try {
    if (!isObj(input) || input.v !== REPORT_VERSION) fail('v');
    const score = int(input.score, 0, 100, 'score');
    const stage = int(input.stage, 1, 5, 'stage');
    const archetype = oneOf(input.archetype, ARCHETYPES, 'archetype');
    const w = isObj(input.window) ? input.window : fail('window');
    const window = { days: int(w.days, 1, 3650, 'window.days'), startDay: day(w.startDay, 'window.startDay'), endDay: day(w.endDay, 'window.endDay') };
    const s = isObj(input.sample) ? input.sample : fail('sample');
    const sample = {
      prompts: int(s.prompts, 0, MAX_COUNT, 'sample.prompts'),
      sessions: int(s.sessions, 0, MAX_COUNT, 'sample.sessions'),
      activeDays: int(s.activeDays, 0, window.days, 'sample.activeDays'),
      activeHours: num(s.activeHours, 0, window.days * 24, 'sample.activeHours'),
    };
    if (!Array.isArray(input.criteria) || input.criteria.length > Object.keys(CRITERIA).length) fail('criteria');
    const seen = new Set();
    const criteria = input.criteria.map((c) => {
      if (!isObj(c)) fail('criteria[]');
      const key = oneOf(c.key, CRITERIA, 'criteria.key');
      if (seen.has(key)) fail('criteria.key');
      seen.add(key);
      const points = int(c.points, 0, 100, 'criteria.points');
      if (c.earned === null) return { key, points, earned: null, parts: [] };
      const earned = num(c.earned, 0, points, 'criteria.earned');
      if (!Array.isArray(c.parts) || c.parts.length < 1 || c.parts.length > 2) fail('criteria.parts');
      const parts = c.parts.map((p) => {
        if (!isObj(p)) fail('parts[]');
        return {
          metric: oneOf(p.metric, METRICS, 'parts.metric'),
          value: num(p.value, 0, MAX_COUNT, 'parts.value'),
          from: num(p.from, 0, MAX_COUNT, 'parts.from'),
          to: num(p.to, 0, MAX_COUNT, 'parts.to'),
        };
      });
      return { key, points, earned, parts };
    });
    const e = isObj(input.extras) ? input.extras : fail('extras');
    const bd = isObj(e.busiestDay) ? e.busiestDay : fail('extras.busiestDay');
    const extras = {
      peakHour: int(e.peakHour, 0, 23, 'extras.peakHour'),
      peakWeekday: int(e.peakWeekday, 0, 6, 'extras.peakWeekday'),
      currentStreak: int(e.currentStreak, 0, window.days, 'extras.currentStreak'),
      longestSessionHours: num(e.longestSessionHours, 0, window.days * 24, 'extras.longestSessionHours'),
      busiestDay: { day: day(bd.day, 'busiestDay.day'), prompts: int(bd.prompts, 0, MAX_COUNT, 'busiestDay.prompts') },
    };
    if (!isObj(input.modelMix)) fail('modelMix');
    const modelMix = {};
    for (const [k, v] of Object.entries(input.modelMix)) {
      if (!MODEL_FAMILIES.includes(k)) fail('modelMix.key');
      modelMix[k] = num(v, 0, 1, 'modelMix.value');
    }
    const us = isObj(input.usage) ? input.usage : fail('usage');
    if (!isObj(us.toolCalls)) fail('usage.toolCalls');
    const toolCalls = {};
    for (const [k, v] of Object.entries(us.toolCalls)) {
      if (!TOOL_NAMES.includes(k)) fail('usage.toolCalls.key');
      toolCalls[k] = int(v, 0, MAX_COUNT, 'usage.toolCalls.value');
    }
    const minuteOrNull = (v, what) => (v === null ? null : int(v, 0, 24 * 60 - 1, what));
    const usage = {
      outputTokens: int(us.outputTokens, 0, 1e13, 'usage.outputTokens'),
      totalTokens: int(us.totalTokens, 0, 1e14, 'usage.totalTokens'),
      toolCalls,
      subagents: int(us.subagents, 0, MAX_COUNT, 'usage.subagents'),
      compactions: int(us.compactions, 0, MAX_COUNT, 'usage.compactions'),
      interruptions: int(us.interruptions, 0, MAX_COUNT, 'usage.interruptions'),
      longestTurnMinutes: num(us.longestTurnMinutes, 0, window.days * 24 * 60, 'usage.longestTurnMinutes'),
      claudeHours: num(us.claudeHours, 0, window.days * 24 * 20, 'usage.claudeHours'),
      projects: int(us.projects, 0, 100_000, 'usage.projects'),
      latestNightMinute: minuteOrNull(us.latestNightMinute, 'usage.latestNightMinute'),
      earliestMorningMinute: minuteOrNull(us.earliestMorningMinute, 'usage.earliestMorningMinute'),
    };
    const report = {
      v: REPORT_VERSION,
      score,
      stage,
      archetype,
      window,
      sample,
      criteria,
      extras,
      modelMix,
      usage,
      hours: ints(input.hours, 24, 'hours'),
      weekdays: ints(input.weekdays, 7, 'weekdays'),
      daily: ints(input.daily, window.days, 'daily'),
    };
    // The card must describe the same result, and pass the same strict parser as share URLs.
    if (!isObj(input.card)) fail('card');
    const card = decodeCard(encodeCard({ ...input.card, sym: isObj(input.card.sym) ? input.card.sym : {} }));
    if (!card || card.score !== score || card.stage !== stage || card.archetype !== archetype) fail('card');
    report.card = card;
    return { report };
  } catch (err) {
    if (err instanceof Invalid) return { error: `invalid field: ${err.message}` };
    return { error: 'invalid report' };
  }
}

// ---------------------------------------------------------------------------
// Canvas renderer (browser only): the card is a patient monitor screen, 1200×630.
// Needs the VT323 and IBM Plex Mono fonts loaded (see ui.js / report template).

export const MONITOR = {
  screen: '#030A06', bezel: '#0F3A22', line: '#1A5C37', grid: '#0B2416',
  ph: '#3BFF8C', dim: '#1F9A57', faint: '#2E7550', ink: '#B9F7D2',
  amber: '#FFB020', cyan: '#44E0FF', red: '#FF4D4D', magenta: '#FF5AD1',
  stages: { 1: '#3BFF8C', 2: '#B8F23B', 3: '#FFD21F', 4: '#FFB020', 5: '#FF4D4D' },
};
// Kept for callers of the previous API.
export const THEMES = { light: MONITOR, dark: MONITOR };

const DISPLAY = 'VT323, ui-monospace, monospace';
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, monospace';

// Short readouts for the bottom row of the monitor.
const READOUTS = [
  { key: 'sk', label: 'STREAK', fmt: (v) => `${v} D`, color: 'amber' },
  { key: 'h', label: 'HOURS/DAY', fmt: (v) => `${v.toFixed(1)} H`, color: 'cyan' },
  { key: 'p', label: 'PROMPTS/DAY', fmt: (v) => `${v}`, color: 'ph' },
  { key: 'ad', label: 'DAYS ACTIVE', fmt: (v) => `${v}%`, color: 'ph' },
  { key: 'o', label: 'OPUS', fmt: (v) => `${v}%`, color: 'magenta' },
  { key: 'w', label: 'WEEKEND', fmt: (v) => `${v}%`, color: 'cyan' },
  { key: 'n', label: '0-5 AM', fmt: (v) => `${v}%`, color: 'cyan' },
  { key: 'l', label: 'LIMITS HIT', fmt: (v) => `${v}×`, color: 'amber' },
  { key: 'ls', label: 'LONGEST SESSION', fmt: (v) => `${v.toFixed(1)} H`, color: 'magenta' },
  { key: 'sa', label: 'SUBAGENTS', fmt: (v) => `${v}`, color: 'amber' },
  { key: 'wd', label: 'WORDS/DAY', fmt: (v) => compact(v), color: 'cyan' },
];
export const readouts = (card) =>
  card.headlines && card.headlines.length
    ? card.headlines
    : READOUTS.filter((r) => card.sym[r.key] != null).map((r) => ({ ...r, value: r.fmt(card.sym[r.key]) }));

/** ECG points (in a w×h box) from daily prompt counts: one heartbeat per day, height = prompts. */
export function ecgPoints(daily, w, h) {
  const n = daily.length;
  const max = Math.max(1, ...daily);
  const step = w / n;
  const base = h * 0.72;
  const pts = [];
  daily.forEach((v, i) => {
    const x = i * step;
    const a = (v / max) * h * 0.66;
    if (v === 0) {
      pts.push([x, base], [x + step, base]);
      return;
    }
    pts.push([x, base], [x + step * 0.3, base], [x + step * 0.36, base - a * 0.12], [x + step * 0.42, base],
      [x + step * 0.48, base - a], [x + step * 0.54, base + a * 0.28], [x + step * 0.6, base], [x + step, base]);
  });
  return pts;
}

/** A generic rhythm when no daily series is available (share links carry no daily data). */
function syntheticDaily(score) {
  return Array.from({ length: 14 }, (_, i) => Math.round(30 + score * (0.5 + 0.5 * Math.abs(Math.sin(i * 1.7)))));
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glowText(ctx, text, x, y, color, blur = 14) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.fillText(text, x, y);
  ctx.restore();
}

export function drawCard(ctx, card, { siteLabel = '', credit = '' } = {}) {
  const c = MONITOR;
  const W = CARD_WIDTH;
  const H = CARD_HEIGHT;
  const stage = STAGES[card.stage];
  const arch = ARCHETYPES[card.archetype];
  ctx.save();
  ctx.textBaseline = 'alphabetic';

  // Bezel and screen
  ctx.fillStyle = '#010302';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = c.screen;
  roundRect(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.fill();
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Top bar
  ctx.textAlign = 'left';
  ctx.font = `400 34px ${DISPLAY}`;
  glowText(ctx, '● CLAUDE DEPENDENCY MONITOR', 48, 66, c.ph, 12);
  ctx.fillStyle = c.red;
  ctx.fillText('●', 48, 66);
  ctx.font = `400 22px ${DISPLAY}`;
  ctx.fillStyle = c.dim;
  ctx.fillText(`BED 04 · ANONYMOUS DEVELOPER${card.days ? ` · OBSERVED ${card.days} DAYS` : ''}`, 48, 94);
  // Alarm
  ctx.font = `400 28px ${DISPLAY}`;
  const alarm = arch.alarm || '● STABLE';
  const aw = ctx.measureText(alarm).width + 28;
  ctx.fillStyle = alarm.startsWith('▲') ? c.amber : c.ph;
  ctx.fillRect(W - 48 - aw, 44, aw, 34);
  ctx.fillStyle = '#000';
  ctx.fillText(alarm, W - 48 - aw + 14, 70);

  ctx.strokeStyle = c.bezel;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 112);
  ctx.lineTo(W - 48, 112);
  ctx.stroke();

  // ECG panel
  const ex = 48;
  const ey = 128;
  const ew = 720;
  const eh = 220;
  ctx.strokeStyle = c.grid;
  for (let gx = ex; gx <= ex + ew; gx += 30) { ctx.beginPath(); ctx.moveTo(gx, ey); ctx.lineTo(gx, ey + eh); ctx.stroke(); }
  for (let gy = ey; gy <= ey + eh; gy += 30) { ctx.beginPath(); ctx.moveTo(ex, gy); ctx.lineTo(ex + ew, gy); ctx.stroke(); }
  ctx.font = `400 22px ${DISPLAY}`;
  ctx.fillStyle = c.dim;
  ctx.fillText(card.ecg ? `II · PROMPTS TO CLAUDE PER DAY · ${card.ecg.length} D` : 'II · DEPENDENCY RHYTHM', ex + 8, ey + 24);
  const pts = ecgPoints(card.ecg || syntheticDaily(card.score), ew, eh);
  ctx.save();
  ctx.strokeStyle = c.ph;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.shadowColor = c.ph;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(ex + x, ey + y) : ctx.moveTo(ex + x, ey + y)));
  ctx.stroke();
  ctx.restore();

  // Diagnosis
  ctx.font = `400 26px ${DISPLAY}`;
  ctx.fillStyle = c.amber;
  ctx.fillText(`DX · ${arch.code}`, 48, 392);
  let size = 62;
  do ctx.font = `400 ${size}px ${DISPLAY}`; while (ctx.measureText(arch.name.toUpperCase()).width > 720 && --size > 34);
  glowText(ctx, arch.name.toUpperCase(), 48, 440, c.ph, 14);
  ctx.font = `400 17px ${MONO}`;
  ctx.fillStyle = c.ink;
  wrap(ctx, arch.tagline, 720).slice(0, 2).forEach((l, i) => ctx.fillText(l, 48, 472 + i * 22));

  // Score column
  ctx.strokeStyle = c.bezel;
  ctx.beginPath();
  ctx.moveTo(800, 128);
  ctx.lineTo(800, 500);
  ctx.stroke();
  ctx.font = `400 26px ${DISPLAY}`;
  ctx.fillStyle = c.dim;
  ctx.fillText('CLAUDE DEPENDENCY', 824, 152);
  ctx.textAlign = 'right';
  ctx.fillText('/100', W - 48, 152);
  ctx.font = `400 270px ${DISPLAY}`;
  glowText(ctx, String(card.score), W - 48, 380, '#EFFFF5', 26);
  ctx.font = `400 34px ${DISPLAY}`;
  glowText(ctx, `STAGE ${card.stage} · ${stage.name.toUpperCase()}`, W - 48, 428, c.stages[card.stage], 10);
  ctx.textAlign = 'left';

  // Readouts row
  const cells = readouts(card).slice(0, 4);
  const cw = (W - 96) / 4;
  ctx.strokeStyle = c.bezel;
  ctx.beginPath();
  ctx.moveTo(48, 508);
  ctx.lineTo(W - 48, 508);
  ctx.stroke();
  cells.forEach((r, i) => {
    const x = 48 + i * cw;
    ctx.font = `400 20px ${DISPLAY}`;
    ctx.fillStyle = c.dim;
    ctx.fillText(r.label, x, 534);
    ctx.font = `400 40px ${DISPLAY}`;
    glowText(ctx, r.value, x, 568, c[r.color], 8);
  });

  // Footer
  ctx.font = `400 20px ${DISPLAY}`;
  ctx.fillStyle = c.dim;
  ctx.fillText(`HOW ADDICTED TO CLAUDE ARE YOU?${credit ? `  ·  BY ${credit.toUpperCase()}` : ''}`, 48, 600);
  ctx.textAlign = 'right';
  ctx.fillStyle = c.faint;
  ctx.fillText(`NOT AN ACTUAL MEDICAL DIAGNOSIS${siteLabel ? ` · ${siteLabel.toUpperCase()}` : ''}`, W - 48, 600);
  ctx.textAlign = 'left';

  // Scanlines + vignette
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 16; y < H - 16; y += 3) ctx.fillRect(16, y, W - 32, 1);
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  roundRect(ctx, 14, 14, W - 28, H - 28, 26);
  ctx.fill();
  ctx.restore();
}

/** Renders into a canvas at `scale` × 1200×630 (use scale 1 for the exported PNG). */
export function renderCardToCanvas(canvas, card, opts = {}) {
  const scale = opts.scale || 1;
  canvas.width = CARD_WIDTH * scale;
  canvas.height = CARD_HEIGHT * scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  drawCard(ctx, card, opts);
  return canvas;
}
