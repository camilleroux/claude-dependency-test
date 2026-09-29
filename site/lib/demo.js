// A made-up report served at /case/demo, so the landing page can show a full example.
const days = 30;
const daily = Array.from({ length: days }, (_, i) => (i % 9 === 4 ? 0 : 30 + ((i * 37) % 55) + (i % 7 === 5 ? 25 : 0)));
const prompts = daily.reduce((a, b) => a + b, 0);
const activeDays = daily.filter(Boolean).length;
const hours = [22, 17, 11, 6, 2, 0, 0, 1, 4, 18, 41, 55, 38, 44, 62, 70, 66, 58, 40, 36, 52, 61, 57, 40];
const scale = prompts / hours.reduce((a, b) => a + b, 0);
const byHour = hours.map((h) => Math.round(h * scale));
byHour[15] += prompts - byHour.reduce((a, b) => a + b, 0);
const byWeekday = [0, 0, 0, 0, 0, 0, 0];
daily.forEach((n, i) => { byWeekday[i % 7] += n; }); // 2026-08-30 is a Sunday

export const DEMO_REPORT = {
  v: 1,
  score: 72,
  stage: 4,
  archetype: 'session-overextension',
  card: { score: 72, stage: 4, archetype: 'session-overextension', days, sym: { h: 5.2, ad: 87, sk: 12, p: 64, ls: 6.4, wd: 273000 } },
  window: { days, startDay: '2026-08-30', endDay: '2026-09-28' },
  sample: { prompts, sessions: 118, activeDays, activeHours: 135.2 },
  criteria: [
    { key: 'hours', points: 20, earned: 12.5, parts: [{ metric: 'activeHoursPerActiveDay', value: 5.2, from: 0.5, to: 8 }] },
    { key: 'streak', points: 15, earned: 7.9, parts: [{ metric: 'longestStreakDays', value: 12, from: 2, to: 21 }] },
    { key: 'presence', points: 10, earned: 9.6, parts: [{ metric: 'activeDaysShare', value: 0.867, from: 0.15, to: 0.9 }] },
    { key: 'intensity', points: 10, earned: 7.9, parts: [{ metric: 'promptsPerActiveDay', value: 64, from: 5, to: 80 }] },
    { key: 'marathon', points: 10, earned: 10, parts: [{ metric: 'longestSessionHours', value: 6.4, from: 1, to: 6 }] },
    { key: 'delegation', points: 10, earned: 4.4, parts: [{ metric: 'subagentsPerActiveDay', value: 3.6, from: 0, to: 8 }] },
    { key: 'output', points: 10, earned: 9.1, parts: [{ metric: 'wordsPerActiveDay', value: 273000, from: 15000, to: 300000 }] },
    { key: 'limits', points: 10, earned: null, parts: [] },
    { key: 'opus', points: 5, earned: 3.6, parts: [{ metric: 'opusShare', value: 0.71, from: 0, to: 1 }] },
  ],
  extras: { peakHour: 15, peakWeekday: byWeekday.indexOf(Math.max(...byWeekday)), currentStreak: 9, longestSessionHours: 6.4, busiestDay: { day: '2026-09-24', prompts: Math.max(...daily) } },
  modelMix: { opus: 0.71, fable: 0.22, sonnet: 0.06, haiku: 0.01 },
  usage: {
    outputTokens: 9_840_000,
    totalTokens: 2_310_000_000,
    toolCalls: { Bash: 8_412, Read: 2_390, Edit: 1_204, Write: 288, Grep: 610, Glob: 342, Agent: 96, WebSearch: 121, WebFetch: 84, mcp: 157, other: 64 },
    subagents: 96,
    compactions: 11,
    interruptions: 38,
    longestTurnMinutes: 142,
    claudeHours: 88.4,
    projects: 9,
    latestNightMinute: 3 * 60 + 47,
    earliestMorningMinute: 7 * 60 + 12,
  },
  hours: byHour,
  weekdays: byWeekday,
  daily,
};
