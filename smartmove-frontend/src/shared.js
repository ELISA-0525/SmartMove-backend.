// Shared API + storage helpers. Endpoints the backend doesn't have yet (404/405/501)
// fall back to browser storage via tryApi, so every screen works today and switches
// to the real backend automatically once the endpoint exists.
export const base = () => { try { return localStorage.getItem('sm_base') || 'http://localhost:5001'; } catch { return 'http://localhost:5001'; } };
export const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
export const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* session only */ } };

export async function send(path, method = 'GET', body, token) {
  let r;
  try {
    r = await fetch(`${base()}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) }, body: body && JSON.stringify(body) });
  } catch { throw new Error(`Cannot reach the API at ${base()}. Start the backend and check the address.`); }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(b.error || b.message || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return b;
}
export async function tryApi(remote, fallback) {
  try { return { data: await remote(), local: false }; }
  catch (e) { if (![404, 405, 501].includes(e.status)) throw e; return { data: await fallback(), local: true }; }
}

// Admin CRUD: PUT/DELETE /api/<res>/:id, with a local overlay so the tables reflect changes.
const ov = (n) => ({ edits: {}, deleted: [], ...jget(`sm_ov_${n}`, {}) });
export const withOverlay = (n, rows, k) => { const o = ov(n); return rows.filter((r) => !o.deleted.includes(r[k])).map((r) => ({ ...r, ...o.edits[r[k]] })); };
export async function mutate(n, method, key, body, remoteId = key) {
  const { local } = await tryApi(() => send(`/api/${n}/${encodeURIComponent(remoteId)}`, method, body), () => null);
  const o = ov(n);
  if (method === 'DELETE') o.deleted.push(key); else o.edits[key] = { ...o.edits[key], ...body };
  jset(`sm_ov_${n}`, o);
  return local;
}
