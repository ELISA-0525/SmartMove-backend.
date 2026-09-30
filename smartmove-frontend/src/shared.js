// Shared API + browser fallback helpers.
export const base = () => { try { return localStorage.getItem('sm_base') || 'http://localhost:5001'; } catch { return 'http://localhost:5001'; } };
export const jget = (k, f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
export const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* session only */ } };

export async function send(path, method = 'GET', body, token) {
  let r;
  try {
    r = await fetch(`${base()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch { throw new Error(`Cannot reach the API at ${base()}. Start the backend and check the address.`); }
  const b = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(b.error || b.message || `Request failed (${r.status})`); e.status = r.status; throw e; }
  return b;
}

export async function tryApi(remote, fallback) {
  try { return { data: await remote(), local: false }; }
  catch (e) { if (![404, 405, 501].includes(e.status)) throw e; return { data: await fallback(), local: true }; }
}

// Admin CRUD: PUT/DELETE /api/<resource>/:id, with a local overlay so tables reflect changes.
const ov = (n) => ({ edits: {}, deleted: [], ...jget(`sm_ov_${n}`, {}) });
export const withOverlay = (n, rows, k) => {
  const o = ov(n);
  return rows.filter((r) => !o.deleted.includes(r[k])).map((r) => ({ ...r, ...o.edits[r[k]] }));
};

export async function mutate(n, method, key, body, remoteId = key) {
  const { local } = await tryApi(() => send(`/api/${n}/${encodeURIComponent(remoteId)}`, method, body), () => null);
  const o = ov(n);
  if (method === 'DELETE') o.deleted = [...new Set([...o.deleted, key])];
  else o.edits[key] = { ...o.edits[key], ...body };
  jset(`sm_ov_${n}`, o);
  return local;
}

// Creates a record remotely when the backend exposes POST /api/<resource>.
// If that endpoint is not available yet, the record is kept in this browser so the UI remains usable.
export async function createResource(n, body, makeLocal) {
  const result = await tryApi(
    () => send(`/api/${n}`, 'POST', body),
    async () => makeLocal(),
  );
  const payload = result.data?.data?.[n.slice(0, -1)] || result.data?.data?.[n] || result.data?.data || result.data;
  const row = payload && typeof payload === 'object' ? payload : makeLocal();
  const existing = jget(`sm_new_${n}`, []);
  const key = row.id ?? row.driver_id ?? row.vehicle_id ?? row.registration_no ?? row.registration ?? row.reg ?? row.name;
  const merged = existing.filter((x) => String(x.id ?? x.driver_id ?? x.vehicle_id ?? x.registration_no ?? x.registration ?? x.reg ?? x.name) !== String(key));
  jset(`sm_new_${n}`, [...merged, { ...row, ...(result.local ? { localOnly: true } : {}) }]);
  return { row, local: result.local };
}

export const newRows = (n) => jget(`sm_new_${n}`, []);
export const removeNewRow = (n, predicate) => jset(`sm_new_${n}`, jget(`sm_new_${n}`, []).filter((r) => !predicate(r)));
