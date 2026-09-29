// The fun layer: doctor's notes, side effects and a prescription, each triggered by a real number
// from the report (thresholds below). Deterministic: the same report always gets the same jokes.
import { WAR_AND_PEACE_WORDS, WORDS_PER_TOKEN, compact } from '../public/card.js';

const n = (v) => Math.round(v).toLocaleString('en-US');
const pctOf = (r, metric) => {
  for (const c of r.criteria) for (const p of c.parts) if (p.metric === metric) return p.value;
  return null;
};

/** One short handwritten note per chapter, or null when nothing is note-worthy. */
export function doctorNotes(r) {
  const u = r.usage;
  const notes = {};

  const streak = r.extras.currentStreak;
  if (streak >= 14) notes.attendance = `${streak} days in a row. The patient hasn't taken a day off. Neither has Claude.`;
  else if (r.sample.activeDays === r.window.days) notes.attendance = 'Perfect attendance. We checked twice.';
  else if (r.sample.activeDays / r.window.days < 0.3) notes.attendance = 'Some days without Claude. Patient reports they were "fine".';
  else {
    const weekday = new Date(`${r.extras.busiestDay.day}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    notes.attendance = `Busiest day: ${n(r.extras.busiestDay.prompts)} prompts. Patient describes it as "a normal ${weekday}".`;
  }

  // Durations, not hours of the day: we don't judge when people work, only how much.
  const perWeek = Math.round((r.sample.activeHours / r.window.days) * 7);
  if (perWeek >= 35) notes.clock = `${Math.round(perWeek)} h a week with Claude. A full-time job is 35. This one doesn't pay overtime.`;
  else if (perWeek >= 20) notes.clock = `${Math.round(perWeek)} h a week with Claude. Officially a part-time job.`;
  else if (r.extras.longestSessionHours >= 3) notes.clock = `Longest session: ${r.extras.longestSessionHours.toFixed(1)} h without a break. Claude didn't need one either.`;
  else notes.clock = `${Math.round(perWeek)} h a week with Claude. Dosage within reason.`;

  if (u.subagents >= 150) notes.effects = `${n(u.subagents)} subagents hired. That's bigger than most startups.`;
  else if (u.subagents >= 50) notes.effects = `${n(u.subagents)} subagents hired. A whole department, zero meetings.`;
  else if ((u.toolCalls.Bash || 0) >= 5000) notes.effects = `${compact(u.toolCalls.Bash)} shell commands. The terminal has filed a complaint.`;
  else if (u.interruptions >= 30) notes.effects = `${n(u.interruptions)} interruptions. Claude is fine. Claude is totally fine.`;
  else notes.effects = 'Vitals look busy but stable.';

  const [top, share] = Object.entries(r.modelMix).sort((a, b) => b[1] - a[1])[0] || [];
  if (top === 'opus' && share >= 0.5) notes.medication = 'Prefers the premium dose. Insurance will not cover this.';
  else if (top === 'haiku') notes.medication = 'Micro-dosing. Efficient and poetic.';
  else if (top) notes.medication = `Mostly ${top[0].toUpperCase()}${top.slice(1)}. A patient of taste.`;

  const worst = [...r.criteria].filter((c) => c.earned !== null).sort((a, b) => b.earned / b.points - a.earned / a.points)[0];
  const SYMPTOM = { hours: 'long hours', streak: 'the streak', presence: 'showing up every day', intensity: 'prompt volume', marathon: 'marathon sessions', delegation: 'delegating to subagents', output: 'sheer output', limits: 'hitting limits', opus: 'Opus cravings' };
  if (worst) notes.profile = `Main symptom: ${SYMPTOM[worst.key] || worst.key}. Textbook.`;
  return notes;
}

/** "Possible side effects (observed in this patient)": each one needs its own trigger. */
export function sideEffects(r) {
  const u = r.usage;
  const t = u.toolCalls;
  const list = [];
  const add = (text, evidence) => list.push({ text, evidence });
  const perWeek = (r.sample.activeHours / r.window.days) * 7;
  if (r.extras.currentStreak >= 7) add('Inability to go a day without Claude', `${r.extras.currentStreak}-day streak`);
  if (perWeek >= 20) add('A second job, unpaid', `${Math.round(perWeek)} h a week with Claude`);
  if (r.extras.longestSessionHours >= 3) add('Losing track of time mid-session', `longest session ${r.extras.longestSessionHours.toFixed(1)} h`);
  if (r.sample.activeDays / r.window.days >= 0.8) add('A calendar made entirely of Claude days', `${r.sample.activeDays} of ${r.window.days} days`);
  if (r.extras.busiestDay.prompts >= 100) add('Occasional prompt binges', `${n(r.extras.busiestDay.prompts)} prompts in one day`);
  if (u.interruptions >= 20) add('Compulsive Esc-pressing', `${n(u.interruptions)} interruptions`);
  if (u.subagents >= 30) add('Managing a team you have never met', `${n(u.subagents)} subagents`);
  if ((t.Bash || 0) >= 2000) add('Saying "just run it" out loud', `${compact(t.Bash)} shell commands`);
  if (u.compactions >= 3) add('Conversations too long to remember', `${n(u.compactions)} context overflows`);
  const opus = r.modelMix.opus || 0;
  if (opus >= 0.5) add('Expensive taste', `${Math.round(opus * 100)}% Opus`);
  const limits = pctOf(r, 'limitHitsPer30Days');
  if (limits != null && limits > 0) add('Knowing the usage reset time by heart', 'usage limit reached');
  if (u.projects >= 10) add('Starting projects faster than finishing them', `${n(u.projects)} projects`);
  if (u.longestTurnMinutes >= 60) add('Letting Claude work for hours on a single request', `longest solo run ${Math.round(u.longestTurnMinutes)} min`);
  if (!list.length) add('None observed. Suspiciously healthy.', 'all vitals within normal range');
  return list.slice(0, 8); // durations and streaks come first
}

/** Real-number equivalences for the "words" feature. */
export function typingTime(outputTokens) {
  const words = outputTokens * WORDS_PER_TOKEN;
  const days = words / 40 / 60 / 24; // 40 words per minute, nonstop
  return { words, books: words / WAR_AND_PEACE_WORDS, days };
}

/** The prescription at the end: dosage from the patient's own numbers. */
export function prescription(r) {
  const perDay = Math.round(r.sample.prompts / Math.max(1, r.sample.activeDays));
  const lines = [
    `Claude, as needed. Current dose: ${n(perDay)} prompts per active day.`,
  ];
  if (r.extras.longestSessionHours >= 1.5) lines.push(`Stand up and stretch every 90 minutes. Patient's longest session: ${r.extras.longestSessionHours.toFixed(1)} h.`);
  else lines.push('Sessions of reasonable length. Keep it that way.');
  if (r.extras.currentStreak >= 7) lines.push(`One day off per week, recommended. Current streak: ${r.extras.currentStreak} days.`);
  else lines.push('Take a day off now and then. Claude will still be there.');
  lines.push('Refills: unlimited. Side effects: may include shipping.');
  return lines;
}
