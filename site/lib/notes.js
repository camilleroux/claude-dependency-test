// The fun layer: doctor's notes, side effects and a prescription, each triggered by a real number
// from the report (thresholds below). Deterministic: the same report always gets the same jokes.
// English and French side by side; `lang` is 'en' (default) or 'fr'.
import { WAR_AND_PEACE_WORDS, WORDS_PER_TOKEN, compact } from '../public/card.js';

const n = (v, lang) => Math.round(v).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
const dec = (v, lang) => (lang === 'fr' ? v.toFixed(1).replace('.', ',') : v.toFixed(1));
const pctOf = (r, metric) => {
  for (const c of r.criteria) for (const p of c.parts) if (p.metric === metric) return p.value;
  return null;
};

/** One short note per chapter, or nothing when nothing is note-worthy. */
export function doctorNotes(r, lang = 'en') {
  const fr = lang === 'fr';
  const u = r.usage;
  const notes = {};

  const streak = r.extras.currentStreak;
  if (streak >= 14) notes.attendance = fr ? `${streak} jours d'affilée. Le patient n'a pas pris un seul jour de repos. Claude non plus.` : `${streak} days in a row. The patient hasn't taken a day off. Neither has Claude.`;
  else if (r.sample.activeDays === r.window.days) notes.attendance = fr ? 'Assiduité parfaite. On a vérifié deux fois.' : 'Perfect attendance. We checked twice.';
  else if (r.sample.activeDays / r.window.days < 0.3) notes.attendance = fr ? 'Quelques jours sans Claude. Le patient affirme que « ça allait ».' : 'Some days without Claude. Patient reports they were "fine".';
  else {
    const weekday = new Date(`${r.extras.busiestDay.day}T12:00:00Z`).toLocaleDateString(fr ? 'fr-FR' : 'en-US', { weekday: 'long', timeZone: 'UTC' });
    notes.attendance = fr
      ? `Journée la plus chargée : ${n(r.extras.busiestDay.prompts, lang)} prompts. Le patient parle d'« un ${weekday} normal ».`
      : `Busiest day: ${n(r.extras.busiestDay.prompts, lang)} prompts. Patient describes it as "a normal ${weekday}".`;
  }

  // Durations, not hours of the day: we don't judge when people work, only how much.
  const perWeek = Math.round((r.sample.activeHours / r.window.days) * 7);
  if (perWeek >= 35) notes.clock = fr ? `${perWeek} h par semaine avec Claude. Un temps plein, c'est 35. Celui-ci ne paie pas les heures sup.` : `${perWeek} h a week with Claude. A full-time job is 35. This one doesn't pay overtime.`;
  else if (perWeek >= 20) notes.clock = fr ? `${perWeek} h par semaine avec Claude. Officiellement un temps partiel.` : `${perWeek} h a week with Claude. Officially a part-time job.`;
  else if (r.extras.longestSessionHours >= 3) notes.clock = fr ? `Plus longue session : ${dec(r.extras.longestSessionHours, lang)} h sans pause. Claude n'en a pas eu besoin non plus.` : `Longest session: ${dec(r.extras.longestSessionHours, lang)} h without a break. Claude didn't need one either.`;
  else notes.clock = fr ? `${perWeek} h par semaine avec Claude. Posologie raisonnable.` : `${perWeek} h a week with Claude. Dosage within reason.`;

  if (u.subagents >= 150) notes.effects = fr ? `${n(u.subagents, lang)} sous-agents engagés. C'est plus que la plupart des startups.` : `${n(u.subagents, lang)} subagents hired. That's bigger than most startups.`;
  else if (u.subagents >= 50) notes.effects = fr ? `${n(u.subagents, lang)} sous-agents engagés. Un service entier, zéro réunion.` : `${n(u.subagents, lang)} subagents hired. A whole department, zero meetings.`;
  else if ((u.toolCalls.Bash || 0) >= 5000) notes.effects = fr ? `${compact(u.toolCalls.Bash, lang)} commandes shell. Le terminal a déposé une plainte.` : `${compact(u.toolCalls.Bash)} shell commands. The terminal has filed a complaint.`;
  else if (u.interruptions >= 30) notes.effects = fr ? `${n(u.interruptions, lang)} interruptions. Claude va bien. Claude va très bien.` : `${n(u.interruptions, lang)} interruptions. Claude is fine. Claude is totally fine.`;
  else notes.effects = fr ? 'Constantes agitées mais stables.' : 'Vitals look busy but stable.';

  const [top, share] = Object.entries(r.modelMix).sort((a, b) => b[1] - a[1])[0] || [];
  const model = top ? `${top[0].toUpperCase()}${top.slice(1)}` : '';
  if (top === 'opus' && share >= 0.5) notes.medication = fr ? 'Préfère la dose premium. La mutuelle ne rembourse pas.' : 'Prefers the premium dose. Insurance will not cover this.';
  else if (top === 'haiku') notes.medication = fr ? 'Micro-dosage. Efficace et poétique.' : 'Micro-dosing. Efficient and poetic.';
  else if (top) notes.medication = fr ? `Surtout ${model}. Un patient de goût.` : `Mostly ${model}. A patient of taste.`;

  const worst = [...r.criteria].filter((c) => c.earned !== null).sort((a, b) => b.earned / b.points - a.earned / a.points)[0];
  const SYMPTOM = fr
    ? { hours: 'les longues heures', streak: 'la série', presence: 'la présence quotidienne', intensity: 'le volume de prompts', marathon: 'les sessions marathon', delegation: 'la délégation aux sous-agents', output: 'la production pure', limits: 'les limites atteintes', opus: "l'envie d'Opus" }
    : { hours: 'long hours', streak: 'the streak', presence: 'showing up every day', intensity: 'prompt volume', marathon: 'marathon sessions', delegation: 'delegating to subagents', output: 'sheer output', limits: 'hitting limits', opus: 'Opus cravings' };
  if (worst) notes.profile = fr ? `Symptôme principal : ${SYMPTOM[worst.key] || worst.key}. Un cas d'école.` : `Main symptom: ${SYMPTOM[worst.key] || worst.key}. Textbook.`;
  return notes;
}

/** "Possible side effects (observed in this patient)": each one needs its own trigger. */
export function sideEffects(r, lang = 'en') {
  const fr = lang === 'fr';
  const u = r.usage;
  const t = u.toolCalls;
  const list = [];
  const add = (en, frText, evEn, evFr) => list.push({ text: fr ? frText : en, evidence: fr ? evFr : evEn });
  const perWeek = (r.sample.activeHours / r.window.days) * 7;
  const s = r.extras.currentStreak;
  if (s >= 7) add('Inability to go a day without Claude', 'Incapacité à passer une journée sans Claude', `${s}-day streak`, `série de ${s} jours`);
  if (perWeek >= 20) add('A second job, unpaid', 'Un deuxième emploi, non rémunéré', `${Math.round(perWeek)} h a week with Claude`, `${Math.round(perWeek)} h par semaine avec Claude`);
  if (r.extras.longestSessionHours >= 3) add('Losing track of time mid-session', 'Perte de la notion du temps en pleine session', `longest session ${dec(r.extras.longestSessionHours, 'en')} h`, `plus longue session ${dec(r.extras.longestSessionHours, 'fr')} h`);
  if (r.sample.activeDays / r.window.days >= 0.8) add('A calendar made entirely of Claude days', 'Un agenda fait uniquement de journées avec Claude', `${r.sample.activeDays} of ${r.window.days} days`, `${r.sample.activeDays} jours sur ${r.window.days}`);
  if (r.extras.busiestDay.prompts >= 100) add('Occasional prompt binges', 'Crises de prompts occasionnelles', `${n(r.extras.busiestDay.prompts, 'en')} prompts in one day`, `${n(r.extras.busiestDay.prompts, 'fr')} prompts en une journée`);
  if (u.interruptions >= 20) add('Compulsive Esc-pressing', 'Appui compulsif sur Échap', `${n(u.interruptions, 'en')} interruptions`, `${n(u.interruptions, 'fr')} interruptions`);
  if (u.subagents >= 30) add('Managing a team you have never met', "Diriger une équipe qu'on n'a jamais rencontrée", `${n(u.subagents, 'en')} subagents`, `${n(u.subagents, 'fr')} sous-agents`);
  if ((t.Bash || 0) >= 2000) add('Saying "just run it" out loud', 'Dire « vas-y, lance-le » à voix haute', `${compact(t.Bash)} shell commands`, `${compact(t.Bash, 'fr')} commandes shell`);
  if (u.compactions >= 3) add('Conversations too long to remember', "Des conversations trop longues pour s'en souvenir", `${n(u.compactions, 'en')} context overflows`, `${n(u.compactions, 'fr')} débordements de contexte`);
  const opus = r.modelMix.opus || 0;
  if (opus >= 0.5) add('Expensive taste', 'Goûts de luxe', `${Math.round(opus * 100)}% Opus`, `${Math.round(opus * 100)} % d'Opus`);
  const limits = pctOf(r, 'limitHitsPer30Days');
  if (limits != null && limits > 0) add('Knowing the usage reset time by heart', "Connaître par cœur l'heure de remise à zéro", 'usage limit reached', "limite d'usage atteinte");
  if (u.projects >= 10) add('Starting projects faster than finishing them', "Commencer des projets plus vite qu'on ne les termine", `${n(u.projects, 'en')} projects`, `${n(u.projects, 'fr')} projets`);
  if (u.longestTurnMinutes >= 60) add('Letting Claude work for hours on a single request', 'Laisser Claude travailler des heures sur une seule demande', `longest solo run ${Math.round(u.longestTurnMinutes)} min`, `plus long travail en solo ${Math.round(u.longestTurnMinutes)} min`);
  if (!list.length) add('None observed. Suspiciously healthy.', 'Aucun observé. Étrangement sain.', 'all vitals within normal range', 'toutes les constantes dans la norme');
  return list.slice(0, 8); // durations and streaks come first
}

/** Real-number equivalences for the "words" feature. */
export function typingTime(outputTokens) {
  const words = outputTokens * WORDS_PER_TOKEN;
  const days = words / 40 / 60 / 24; // 40 words per minute, nonstop
  return { words, books: words / WAR_AND_PEACE_WORDS, days };
}

/** The prescription at the end: dosage from the patient's own numbers. */
export function prescription(r, lang = 'en') {
  const fr = lang === 'fr';
  const perDay = Math.round(r.sample.prompts / Math.max(1, r.sample.activeDays));
  const lines = [fr ? `Claude, à la demande. Dose actuelle : ${n(perDay, lang)} prompts par jour actif.` : `Claude, as needed. Current dose: ${n(perDay, lang)} prompts per active day.`];
  if (r.extras.longestSessionHours >= 1.5) lines.push(fr ? `Se lever et s'étirer toutes les 90 minutes. Plus longue session du patient : ${dec(r.extras.longestSessionHours, lang)} h.` : `Stand up and stretch every 90 minutes. Patient's longest session: ${dec(r.extras.longestSessionHours, lang)} h.`);
  else lines.push(fr ? 'Des sessions de durée raisonnable. À conserver.' : 'Sessions of reasonable length. Keep it that way.');
  if (r.extras.currentStreak >= 7) lines.push(fr ? `Un jour de repos par semaine, recommandé. Série en cours : ${r.extras.currentStreak} jours.` : `One day off per week, recommended. Current streak: ${r.extras.currentStreak} days.`);
  else lines.push(fr ? 'Prendre un jour de repos de temps en temps. Claude sera toujours là.' : 'Take a day off now and then. Claude will still be there.');
  lines.push(fr ? 'Renouvelable à volonté. Effets secondaires : peut provoquer des mises en production.' : 'Refills: unlimited. Side effects: may include shipping.');
  return lines;
}

/**
 * French pages only: a recommended "treatment", i.e. a Human Coders training matched to the
 * diagnosis. Low stages get the introduction, everyone else the advanced course (subagents, MCP).
 * Returns null in English: the trainings are taught in French.
 */
const TRAINING_URL = (slug, placement) =>
  `https://www.humancoders.com/formations/${slug}?utm_source=claude-dependency-test&utm_medium=referral&utm_campaign=${placement}`;

const TREATMENT_FR = {
  'middle-manager': 'Pour diriger tes sous-agents comme une vraie équipe, sans réunion : orchestration, MCP, SDK.',
  'session-overextension': 'Pour déléguer les longues tâches à des sous-agents, et finir tes sessions avant la batterie.',
  'hypergraphia': 'Pour canaliser ces millions de mots : prompts mieux découpés, sous-agents, workflows industrialisés.',
  'streak-dependency': 'Pour que chaque jour avec Claude compte : customisation, plugins et automatisation des tâches récurrentes.',
  'deep-focus': 'Pour transformer ces heures de travail en workflows automatisés : slash commandes, plugins, MCP.',
  'prompt-hyperactivity': 'Pour obtenir plus avec moins de prompts : décomposition des tâches, commandes et sous-agents.',
  'limit-collision': "Pour arrêter de heurter les limites : gestion du contexte, délégation et workflows plus économes.",
  'opus-affluenza': 'Pour tirer le meilleur de chaque modèle, et garder Opus pour ce qui le mérite.',
};

export function treatment(r, lang = 'en', placement = 'prescription') {
  if (lang !== 'fr') return null;
  const beginner = r.stage <= 2 || r.archetype === 'recreational-use';
  if (beginner) {
    return {
      name: 'Formation Claude Code',
      text: 'Pour passer au stade supérieur : configuration, ingénierie de contexte, commandes et skills. Deux jours.',
      url: TRAINING_URL('claude-code', placement),
    };
  }
  return {
    name: 'Formation Claude Code avancé',
    text: `${TREATMENT_FR[r.archetype] || 'Pour passer à la vitesse supérieure : plugins, MCP, sous-agents et SDK.'} Deux jours.`,
    url: TRAINING_URL('claude-code-avance', placement),
  };
}
