// Key-value storage for published reports. Production: Upstash Redis over its REST API (what
// Vercel's "Upstash for Redis" / former Vercel KV integration provisions). No SDK needed.
// Local dev and tests: an in-memory store installed on globalThis.__cdtStore.

export const TTL_SECONDS = 60 * 60 * 24 * 365; // refreshed on every update

function upstash(url, token) {
  const call = async (command) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
    });
    if (!res.ok) throw new Error(`storage error ${res.status}`);
    return (await res.json()).result;
  };
  return {
    async get(key) {
      const raw = await call(['GET', key]);
      return raw ? JSON.parse(raw) : null;
    },
    async set(key, value, ttl) {
      await call(['SET', key, JSON.stringify(value), 'EX', String(ttl)]);
    },
    async del(key) {
      await call(['DEL', key]);
    },
    async incr(key, ttl) {
      const n = await call(['INCR', key]);
      if (n === 1) await call(['EXPIRE', key, String(ttl)]);
      return n;
    },
  };
}

export function memoryStore() {
  const data = new Map();
  const alive = (key) => {
    const e = data.get(key);
    if (e && e.exp < Date.now()) data.delete(key);
    return data.get(key);
  };
  return {
    async get(key) {
      const e = alive(key);
      return e ? structuredClone(e.value) : null;
    },
    async set(key, value, ttl) {
      data.set(key, { value: structuredClone(value), exp: Date.now() + ttl * 1000 });
    },
    async del(key) {
      data.delete(key);
    },
    async incr(key, ttl) {
      const e = alive(key);
      const n = (e ? e.value : 0) + 1;
      data.set(key, { value: n, exp: e ? e.exp : Date.now() + ttl * 1000 });
      return n;
    },
  };
}

export function getStore() {
  if (globalThis.__cdtStore) return globalThis.__cdtStore;
  const env = typeof process !== 'undefined' ? process.env : {};
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstash(url, token) : null;
}

export const SLUG_RE = /^[A-Za-z0-9]{10}$/;
export const reportKey = (slug) => `cdt:report:${slug}`;

export async function loadReport(slug) {
  if (!SLUG_RE.test(slug || '')) return null;
  const store = getStore();
  if (!store) return null;
  const entry = await store.get(reportKey(slug));
  return entry ? { ...entry, slug } : null;
}
