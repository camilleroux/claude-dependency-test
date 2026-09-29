// GET /api/stats -> { patients }: how many published reports there are, for the landing page.
// A single count, cached at the edge for five minutes.
import { getStore } from '../lib/store.js';
import { patientCount, safely } from '../lib/rank.js';

export const config = { runtime: 'edge' };

export default async function handler() {
  const store = getStore();
  const patients = store ? await safely(() => patientCount(store), null) : null;
  return new Response(JSON.stringify({ patients }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=60, s-maxage=300' },
  });
}
