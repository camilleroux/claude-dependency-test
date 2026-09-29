// Where a score sits among published reports ("more addicted than 72% of patients").
// Two sorted sets keyed by case slug: the score, and when the report expires (so expired reports
// leave the distribution). Nothing else is stored: the score is already in the report itself.
import { rankFrom } from '../public/card.js';
import { TTL_SECONDS } from './store.js';

const SCORES = 'cdt:scores';
const EXPIRES = 'cdt:scores:exp';

export async function recordScore(store, slug, score) {
  const now = Math.floor(Date.now() / 1000);
  await store.zadd(SCORES, score, slug);
  await store.zadd(EXPIRES, now + TTL_SECONDS, slug);
  for (const stale of await store.zrangebyscore(EXPIRES, '-inf', String(now))) await forgetScore(store, stale);
}

export async function forgetScore(store, slug) {
  await store.zrem(SCORES, slug);
  await store.zrem(EXPIRES, slug);
}

export const patientCount = (store) => store.zcard(SCORES);

/** Rank of `score` among published reports, or null when there are too few to compare. */
export async function rankFor(store, score) {
  const [total, below, above] = await Promise.all([
    store.zcard(SCORES),
    store.zcount(SCORES, '-inf', `(${score}`),
    store.zcount(SCORES, `(${score}`, '+inf'),
  ]);
  return rankFrom(below, above, total);
}

/** Never lets a ranking problem break a page or a publication. */
export async function safely(fn, fallback = null) {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}
