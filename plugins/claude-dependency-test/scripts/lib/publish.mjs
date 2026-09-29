// Publishes the aggregate report to the share site and remembers the link locally, so re-running
// the test updates the same page (and the same README badge) instead of creating a new one.
import fs from 'node:fs';
import path from 'node:path';

const TIMEOUT_MS = 10_000;

export function readState(file) {
  try {
    const s = JSON.parse(fs.readFileSync(file, 'utf8'));
    return s && typeof s.slug === 'string' && typeof s.token === 'string' ? s : null;
  } catch {
    return null;
  }
}

function writeState(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

const endpoint = (baseUrl, slug) => `${String(baseUrl).replace(/\/+$/, '')}/api/diagnoses${slug ? `/${slug}` : ''}`;

async function call(fetchImpl, url, init) {
  let res;
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    throw new Error(`could not reach ${new URL(url).host} (${err.cause?.code || err.name})`);
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* empty or non-JSON body */
  }
  return { status: res.status, body };
}

/**
 * @returns {Promise<{ url, slug, updated: boolean }>} throws with a readable message on failure.
 */
export async function publish({ baseUrl, report, stateFile, forceNew = false, fetchImpl = fetch }) {
  const state = readState(stateFile);
  const payload = JSON.stringify(report);
  const headers = { 'content-type': 'application/json' };

  if (state && !forceNew && state.baseUrl === baseUrl) {
    const { status, body } = await call(fetchImpl, endpoint(baseUrl, state.slug), {
      method: 'PUT',
      headers: { ...headers, authorization: `Bearer ${state.token}` },
      body: payload,
    });
    if (status === 200 && body && body.url) return { url: body.url, slug: state.slug, updated: true, rank: body.rank || null };
    if (status !== 404 && status !== 403) throw new Error(body?.error || `share site answered ${status}`);
    // The page expired or was deleted: fall through and create a new one.
  }

  const { status, body } = await call(fetchImpl, endpoint(baseUrl), { method: 'POST', headers, body: payload });
  if (status !== 201 || !body || !body.slug || !body.token || !body.url) {
    throw new Error(body?.error || `share site answered ${status}`);
  }
  writeState(stateFile, { baseUrl, slug: body.slug, token: body.token, url: body.url, publishedAt: new Date().toISOString() });
  return { url: body.url, slug: body.slug, updated: false, rank: body.rank || null };
}

export async function unpublish({ stateFile, fetchImpl = fetch }) {
  const state = readState(stateFile);
  if (!state) return { deleted: false, reason: 'no published page found on this machine' };
  const { status, body } = await call(fetchImpl, endpoint(state.baseUrl, state.slug), {
    method: 'DELETE',
    headers: { authorization: `Bearer ${state.token}` },
  });
  if (status !== 204 && status !== 404) throw new Error(body?.error || `share site answered ${status}`);
  fs.rmSync(stateFile, { force: true });
  return { deleted: true, url: state.url, slug: state.slug };
}
