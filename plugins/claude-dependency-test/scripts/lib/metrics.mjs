// Turns collected timestamps into "symptoms". Pure and deterministic given (collected, options).
import { WORDS_PER_TOKEN } from '../../assets/card.js';
const WEEKDAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const DAY_MS = 86_400_000;

/** Maps a UTC instant to the local calendar day / hour / weekday of `timeZone`. */
export function makeClock(timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const cache = new Map();
  return (ms) => {
    const bucket = Math.floor(ms / 900_000); // 15 min buckets are safe for every real UTC offset
    let v = cache.get(bucket);
    if (!v) {
      const p = {};
      for (const part of fmt.formatToParts(ms)) p[part.type] = part.value;
      v = { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, dow: WEEKDAYS[p.weekday], bucketMinute: (Number(p.hour) % 24) * 60 + Number(p.minute) };
      cache.set(bucket, v);
    }
    // Every real UTC offset is a multiple of 15 min, so the local minute moves with the UTC one.
    return { ...v, minuteOfDay: v.bucketMinute + Math.floor((ms % 900_000) / 60_000) };
  };
}

const dayIndex = (day) => Math.round(Date.parse(`${day}T00:00:00Z`) / DAY_MS);
const indexToDay = (i) => new Date(i * DAY_MS).toISOString().slice(0, 10);

const metric = (value, extra = {}) => ({ available: true, value, ...extra });
const missing = (reason) => ({ available: false, value: null, reason });

export function modelFamily(model) {
  const m = String(model).toLowerCase();
  for (const f of ['opus', 'sonnet', 'haiku', 'fable']) if (m.includes(f)) return f;
  return 'other';
}

/**
 * @param collected output of collect()
 * @param opts { now:number, timeZone:string, cleanupPeriodDays:number, maxDays?:number, config }
 */
export function computeMetrics(collected, opts) {
  const { config, timeZone } = opts;
  const clock = makeClock(timeZone);
  const gapMs = config.sessionGapMinutes * 60_000;
  const min = config.minSamples;

  // --- Observation window -------------------------------------------------
  // Claude Code deletes transcripts older than cleanupPeriodDays, but a session resumed
  // recently keeps its old lines. Clamp to the retention window so a few ancient lines
  // don't stretch the period (and dilute "active days").
  const endDay = clock(opts.now).day;
  const endIdx = dayIndex(endDay);
  const limitDays = Math.max(1, Math.floor(opts.maxDays || opts.cleanupPeriodDays));
  const earliestAllowedIdx = endIdx - limitDays + 1;
  const inWindow = (ms) => {
    const i = dayIndex(clock(ms).day);
    return i >= earliestAllowedIdx && i <= endIdx;
  };
  const activity = collected.activity.filter(inWindow);
  const prompts = collected.prompts.filter(inWindow);
  const limitEvents = collected.limitEvents.filter((e) => inWindow(e.ms));

  if (activity.length === 0 || prompts.length === 0) {
    return { empty: true, window: { timeZone, cleanupPeriodDays: opts.cleanupPeriodDays, endDay } };
  }
  const startIdx = Math.max(earliestAllowedIdx, dayIndex(clock(activity[0]).day));
  const windowDays = endIdx - startIdx + 1;
  const firstRawIdx = collected.activity.length ? dayIndex(clock(collected.activity[0]).day) : startIdx;

  const window = {
    startDay: indexToDay(startIdx),
    endDay,
    days: windowDays,
    timeZone,
    cleanupPeriodDays: opts.cleanupPeriodDays,
    clampedToRetention: firstRawIdx < earliestAllowedIdx,
    likelyTruncatedByCleanup: startIdx === earliestAllowedIdx,
  };

  // --- Sessions & active time -----------------------------------------------
  let sessions = 0;
  let activeMs = 0;
  let weekendMs = 0;
  let longestSessionMs = 0;
  let sessionStart = activity[0];
  let prev = activity[0];
  sessions = 1;
  for (let i = 1; i < activity.length; i++) {
    const t = activity[i];
    const gap = t - prev;
    if (gap > gapMs) {
      longestSessionMs = Math.max(longestSessionMs, prev - sessionStart);
      sessions++;
      sessionStart = t;
    } else {
      activeMs += gap;
      const dow = clock(prev).dow;
      if (dow === 0 || dow === 6) weekendMs += gap;
    }
    prev = t;
  }
  longestSessionMs = Math.max(longestSessionMs, prev - sessionStart);

  // --- Prompt-based stats -----------------------------------------------------
  const activeDaySet = new Set();
  const daily = new Array(windowDays).fill(0);
  const byHour = new Array(24).fill(0);
  const byWeekday = new Array(7).fill(0);
  let night = 0;
  for (const t of prompts) {
    const c = clock(t);
    const di = dayIndex(c.day);
    activeDaySet.add(di);
    daily[di - startIdx]++;
    byHour[c.hour]++;
    byWeekday[c.dow]++;
    if (c.hour >= config.nightHours.start && c.hour < config.nightHours.end) night++;
  }
  const activeDayIdx = [...activeDaySet].sort((a, b) => a - b);
  const activeDays = activeDayIdx.length;
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < activeDayIdx.length; i++) {
    run = i > 0 && activeDayIdx[i] === activeDayIdx[i - 1] + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
  }
  let currentStreak = 0;
  for (let d = activeDaySet.has(endIdx) ? endIdx : endIdx - 1; activeDaySet.has(d); d--) currentStreak++;
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakWeekday = byWeekday.indexOf(Math.max(...byWeekday));
  const busiest = daily.indexOf(Math.max(...daily));

  // --- Models ---------------------------------------------------------------
  const families = {};
  let modelMessages = 0;
  for (const e of collected.modelEvents) {
    if (!inWindow(e.ms)) continue;
    const f = modelFamily(e.model);
    families[f] = (families[f] || 0) + 1;
    modelMessages++;
  }

  // --- Usage stats (fun facts, real numbers) -------------------------------
  const toolCalls = {};
  for (const e of collected.toolEvents) if (inWindow(e.ms)) toolCalls[e.name] = (toolCalls[e.name] || 0) + 1;
  let outputTokens = 0;
  let totalTokens = 0;
  for (const u of collected.usageEvents) {
    if (!inWindow(u.ms)) continue;
    outputTokens += u.out;
    totalTokens += u.total;
  }
  const turns = collected.turns.filter((t) => inWindow(t.ms));
  // Latest prompt of the night: evening and night hours (18:00-05:59) ordered as one night.
  let latestNight = null;
  let earliestMorning = null;
  for (const t of prompts) {
    const m = clock(t).minuteOfDay;
    if (m >= 18 * 60 || m < 6 * 60) {
      const shifted = (m + 6 * 60) % (24 * 60);
      if (latestNight === null || shifted > (latestNight + 6 * 60) % (24 * 60)) latestNight = m;
    } else if (m < 12 * 60 && (earliestMorning === null || m < earliestMorning)) earliestMorning = m;
  }
  const usage = {
    outputTokens,
    totalTokens,
    toolCalls,
    subagents: collected.subagentStarts.filter(inWindow).length,
    compactions: collected.compactions.filter(inWindow).length,
    interruptions: collected.interruptions.filter(inWindow).length,
    longestTurnMinutes: turns.reduce((mx, t) => Math.max(mx, t.durationMs), 0) / 60_000,
    claudeHours: turns.reduce((sum, t) => sum + t.durationMs, 0) / 3_600_000,
    projects: collected.projectLastActivity.filter(inWindow).length,
    latestNightMinute: latestNight,
    earliestMorningMinute: earliestMorning,
  };

  // --- Usage limits -----------------------------------------------------------
  // One limit hit usually produces several error lines (retries, parallel sessions).
  // Lines sharing the same reset time, or within an hour of each other, are one hit.
  let limitHits = 0;
  let lastMs = -Infinity;
  const seenResets = new Set();
  for (const e of limitEvents) {
    if (e.resetsAt !== null) {
      if (!seenResets.has(e.resetsAt)) limitHits++;
      seenResets.add(e.resetsAt);
    } else if (e.ms - lastMs > 3_600_000) {
      limitHits++;
    }
    lastMs = e.ms;
  }
  const limitsDetectable = limitHits > 0 || collected.errorSignalsSeen;

  const hours = activeMs / 3_600_000;
  const enoughPrompts = prompts.length >= min.prompts;
  const tooFewPrompts = `fewer than ${min.prompts} prompts in the observation window`;

  const metrics = {
    activeHoursPerActiveDay: metric(hours / activeDays, { totalActiveHours: hours, sessions, longestSessionHours: longestSessionMs / 3_600_000 }),
    activeDaysShare:
      windowDays >= min.windowDaysForRegularity
        ? metric(activeDays / windowDays, { activeDays, windowDays })
        : missing(`observation window shorter than ${min.windowDaysForRegularity} days`),
    longestStreakDays:
      windowDays >= min.windowDaysForRegularity
        ? metric(longestStreak, { currentStreak })
        : missing(`observation window shorter than ${min.windowDaysForRegularity} days`),
    nightPromptShare: enoughPrompts ? metric(night / prompts.length, { nightPrompts: night }) : missing(tooFewPrompts),
    promptsPerActiveDay: enoughPrompts ? metric(prompts.length / activeDays, { prompts: prompts.length, activeDays }) : missing(tooFewPrompts),
    weekendActivityShare:
      windowDays < min.windowDaysForWeekend
        ? missing(`observation window shorter than ${min.windowDaysForWeekend} days`)
        : activeMs > 0
          ? metric(weekendMs / activeMs)
          : missing('no measurable active time'),
    limitHitsPer30Days: limitsDetectable
      ? metric((limitHits * 30) / windowDays, { limitHits })
      : missing('no rate-limit or API-error markers found in your transcripts (older Claude Code versions do not record them)'),
    longestSessionHours: metric(longestSessionMs / 3_600_000),
    subagentsPerActiveDay: metric(usage.subagents / activeDays, { subagents: usage.subagents }),
    wordsPerActiveDay: outputTokens > 0
      ? metric((outputTokens * WORDS_PER_TOKEN) / activeDays, { words: outputTokens * WORDS_PER_TOKEN })
      : missing('no token usage recorded in your transcripts'),
    opusShare:
      modelMessages >= min.modelMessages
        ? metric((families.opus || 0) / modelMessages, { modelMessages })
        : missing(`fewer than ${min.modelMessages} model responses with a known model`),
  };

  const modelMix = Object.fromEntries(
    Object.entries(families)
      .sort((a, b) => b[1] - a[1])
      .map(([f, n]) => [f, n / modelMessages]),
  );

  return {
    empty: false,
    window,
    metrics,
    usage,
    extras: {
      prompts: prompts.length,
      activeDays,
      sessions,
      totalActiveHours: hours,
      longestSessionHours: longestSessionMs / 3_600_000,
      currentStreak,
      peakHour,
      peakWeekday,
      busiestDay: { day: indexToDay(startIdx + busiest), prompts: daily[busiest] },
      promptsByDay: daily,
      promptsByHour: byHour,
      promptsByWeekday: byWeekday,
      modelMix,
      limitHits: limitsDetectable ? limitHits : null,
    },
  };
}
