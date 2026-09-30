import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { allLocalTrips, createResource, jget, jset, mutate, newRows, removeNewRow, withOverlay } from './shared.js';
import { CrudDialogs, LocalNote, RowActions } from './admin/Crud.jsx';

const NAV = [['dashboard','Dashboard'],['trips','Trips'],['drivers','Drivers'],['vehicles','Vehicles'],['clients','Clients'],['reviews','Reviews'],['lookup','Lookup'],['rates','Rates']];
const TRIP_STATUSES = ['', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const COMPLAINT_TYPES = ['BEHAVIOR', 'CONDITION', 'TIMING', 'SAFETY', 'OTHER'];
const DEFAULT_RATES = { VAN: 120, BUS: 65 }; // Rs. per km - editable on the Rates page

const lkr = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-LK')}`;
const vType = (seats) => (Number(seats) >= 20 ? 'BUS' : 'VAN');
const initials = (n = '') => n.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const formatDate = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const load = (k, f) => { try { return localStorage.getItem(k) || f; } catch { return f; } };
const tone = (s) => ({ COMPLETED: 'ok', IN_PROGRESS: 'blue', SCHEDULED: 'warn', CANCELLED: 'bad' }[String(s).toUpperCase()] || '');

function useLoad(fn, deps) {
  const [s, set] = useState({ data: null, error: '', loading: true });
  useEffect(() => {
    let cur = true;
    set((p) => ({ ...p, loading: true, error: '' }));
    fn().then((data) => cur && set({ data, error: '', loading: false }))
      .catch((e) => cur && set({ data: null, error: e.message, loading: false }));
    return () => { cur = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return s;
}

const Stars = ({ rating }) => {
  const v = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return <span className="stars" aria-label={`${v} out of 5`}>{'★'.repeat(v)}{'☆'.repeat(5 - v)}</span>;
};
const ErrorMessage = ({ message }) => <div className="msg" role="alert">{message}</div>;
const Tag = ({ status }) => <span className={`tag ${tone(status)}`}>{String(status).replace('_', ' ')}</span>;
const Head = ({ title, children, action }) => (
  <div className="head"><div><h1>{title}</h1><p className="sub">{children}</p></div>{action}</div>
);

function Vehicle({ type }) {
  const bus = type === 'BUS';
  return (
    <svg viewBox="0 0 200 70" width="100%" height="84" role="img" aria-label={bus ? 'Bus' : 'Van'}>
      <ellipse cx="100" cy="64" rx="80" ry="4" fill="#0b1b4d" opacity=".08" />
      <path d={bus ? 'M12 18h150l22 16v22H12z' : 'M18 30l30-14h80l30 16 14 6v18H18z'} fill="#fff" stroke="#0b1b4d" strokeWidth="2.5" strokeLinejoin="round" />
      <path d={bus ? 'M24 24h120v14H24z' : 'M54 22h72l20 12H54z'} fill="#c9d3ee" />
      <rect x="16" y="46" width={bus ? 166 : 168} height="4" fill="#ffc400" />
      {[58, 146].map((x) => <circle key={x} cx={x} cy="56" r="9" fill="#0b1b4d" />)}
    </svg>
  );
}

function Modal({ children, onClose }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current && !ref.current.open) ref.current.showModal(); }, []);
  return (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === ref.current) onClose(); }}>{children}</dialog>
  );
}

function ReviewCard({ review }) {
  return (
    <article className="review">
      <Stars rating={review.rating} />
      <h3>{review.review_title || 'No title'}</h3>
      <div>{review.review_text}</div>
      <div className="meta">
        {formatDate(review.review_date)} · Trip {review.trip_id}
        {review.is_complaint && <> · <b style={{ color: 'var(--bad)' }}>Complaint: {review.complaint_type}</b></>}
      </div>
    </article>
  );
}

export default function App() {
  const [view, setView] = useState('dashboard');
  const [apiBase, setApiBase] = useState(() => load('sm_base', 'http://localhost:5001'));
  const [apiAddress, setApiAddress] = useState(apiBase);
  const [showConn, setShowConn] = useState(false);
  const [tripStatus, setTripStatus] = useState('');
  const [tripOffset, setTripOffset] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const [lookupInit, setLookupInit] = useState(null);
  const [rates, setRates] = useState(() => { try { return { ...DEFAULT_RATES, ...JSON.parse(load('sm_rates', '{}')) }; } catch { return DEFAULT_RATES; } });

  const api = useCallback(async (path, options) => {
    let response;
    try { response = await fetch(`${apiBase}${path}`, options); }
    catch { throw new Error(`Cannot reach the API at ${apiBase}. Start the backend with "npm run dev" and check the address.`); }
    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 503) { const err = new Error(body.error || body.message || `Request failed (${response.status})`); err.status = response.status; throw err; }
    return body;
  }, [apiBase]);

  const health = useLoad(() => api('/api/health'), [api]);
  const sample = useLoad(() => api('/api/trips?limit=200&offset=0').then((r) => r.data.trips), [api]);
  const top = useLoad(() => api('/api/reviews/highest-rated').then((r) => r.data), [api]);
  const online = health.data?.status === 'healthy';

  function saveApiAddress(e) {
    e.preventDefault();
    const v = apiAddress.trim().replace(/\/+$/, '');
    if (!v) return;
    setApiAddress(v); setApiBase(v);
    try { localStorage.setItem('sm_base', v); } catch { /* session only */ }
  }
  function saveRates(next) {
    setRates(next);
    try { localStorage.setItem('sm_rates', JSON.stringify(next)); } catch { /* session only */ }
  }
  const openLookup = (kind, id) => { setLookupInit({ kind, id }); setView('lookup'); };
  const shared = { api, sample, top, rates, openLookup, onSelectTrip: (id) => setDialog({ type: 'trip', id }) };

  return (
    <div className="frame">
      <header className="top">
        <div className="brand"><span className="mark">SM</span>SmartMove</div>
        <nav className="nav" aria-label="Main navigation">
          {NAV.map(([id, label]) => (
            <button key={id} type="button" aria-current={view === id ? 'page' : undefined} onClick={() => setView(id)}>{label}</button>
          ))}
        </nav>
        <a className="btn" href="/portal.html" style={{ textDecoration: 'none' }}>Client portal</a>
        <div className="conn">
          <button type="button" aria-expanded={showConn} onClick={() => setShowConn(!showConn)}>
            <span className={`dot ${health.loading ? '' : online ? 'on' : 'off'}`} />
            {health.loading ? 'Checking' : online ? 'API online' : 'API issue'}
          </button>
          {showConn && (
            <form className="pop" onSubmit={saveApiAddress}>
              <label htmlFor="api-address">API address</label>
              <input id="api-address" style={{ width: '100%' }} value={apiAddress}
                onChange={(e) => setApiAddress(e.target.value)} onBlur={saveApiAddress} />
            </form>
          )}
        </div>
      </header>

      <main>
        {view === 'dashboard' && <Dashboard {...shared} health={health} />}
        {view === 'trips' && (
          <Trips {...shared} status={tripStatus} offset={tripOffset} setOffset={setTripOffset}
            setStatus={(s) => { setTripStatus(s); setTripOffset(0); }} />
        )}
        {view === 'drivers' && <Drivers {...shared} />}
        {view === 'vehicles' && <Vehicles {...shared} />}
        {view === 'clients' && <Clients api={api} />}
        {view === 'reviews' && (
          <Reviews api={api} page={reviewPage} setPage={setReviewPage}
            onWriteReview={() => setDialog({ type: 'review', tripId: '' })} />
        )}
        {view === 'lookup' && <Lookup api={api} initial={lookupInit} />}
        {view === 'rates' && <Rates rates={rates} saveRates={saveRates} />}
      </main>

      {dialog?.type === 'trip' && (
        <TripDialog key={`t-${dialog.id}`} api={api} tripId={dialog.id} rates={rates}
          onClose={() => setDialog(null)} onReview={(tripId) => setDialog({ type: 'review', tripId })} />
      )}
      {dialog?.type === 'review' && (
        <ReviewDialog key={`r-${dialog.tripId}`} api={api} tripId={dialog.tripId} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function Kpi({ label, value, pct, foot }) {
  return (
    <section className="card kpi">
      <div className="lbl">{label}</div><div className="val">{value}</div>
      {pct != null && <div className="bar"><i style={{ width: `${Math.min(100, pct)}%` }} /></div>}
      <div className="foot">{foot}</div>
    </section>
  );
}

function Dashboard({ health, sample, top, openLookup }) {
  const trips = sample.data || [];
  const s = (x) => trips.filter((t) => String(t.status).toUpperCase() === x).length;
  const vehicles = new Set(trips.map((t) => t.vehicle_registration));
  const busy = new Set(trips.filter((t) => ['IN_PROGRESS', 'SCHEDULED'].includes(String(t.status).toUpperCase())).map((t) => t.vehicle_registration));
  const done = trips.length ? (s('COMPLETED') / trips.length) * 100 : 0;
  const h = health.data;
  return (
    <>
      <Head title="Operations overview">Live status of trips, fleet and the databases behind them.</Head>
      {sample.error && <ErrorMessage message={sample.error} />}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <Kpi label="Fleet in use" value={vehicles.size ? `${Math.round((busy.size / vehicles.size) * 100)}%` : '-'} pct={vehicles.size ? (busy.size / vehicles.size) * 100 : 0} foot={`${busy.size} of ${vehicles.size} vehicles have active or scheduled trips`} />
        <Kpi label="Completion rate" value={`${done.toFixed(1)}%`} pct={done} foot={`${s('COMPLETED')} of ${trips.length} recent trips completed`} />
        <Kpi label="In progress" value={s('IN_PROGRESS')} foot={`${s('SCHEDULED')} scheduled next`} />
        <Kpi label="Cancelled" value={s('CANCELLED')} foot="Across the latest 200 trips" />
      </div>
      <div className="grid g3">
        <section className="card" aria-live="polite">
          <h3>System health</h3>
          {health.error ? <ErrorMessage message={health.error} /> : !h ? <p className="meta">Checking...</p> : (
            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {[['Backend', h.status === 'healthy' ? 'connected' : h.status], ['Oracle (trips, drivers, routes)', h.databases.oracle.status], ['MongoDB (reviews)', h.databases.mongodb.status]].map(([n, st]) => (
                <div key={n} className="row2"><span className={`tag ${st === 'connected' ? 'ok' : 'bad'}`}>{st}</span>{n}</div>
              ))}
              <p className="meta">Uptime {Math.round(h.uptime)}s · {h.environment} · checked {formatDate(h.timestamp)}</p>
            </div>
          )}
        </section>
        <TopList title="Top drivers" rows={top.data?.top_drivers} name="driver_name" id="driver_id" onOpen={(id) => openLookup('driver', id)} error={top.error} />
        <TopList title="Top vehicles" rows={top.data?.top_vehicles} name="registration_no" id="vehicle_id" error={top.error} />
      </div>
    </>
  );
}

function TopList({ title, rows, name, id, onOpen, error }) {
  return (
    <section className="card">
      <h3>{title}</h3>
      {error ? <ErrorMessage message={error} /> : !rows ? <p className="meta">Loading...</p> : !rows.length ? <div className="empty">No ratings yet.</div> : (
        <div style={{ display: 'grid', gap: 12, marginTop: 12 }}>
          {rows.slice(0, 5).map((r) => (
            <div key={r[id] || r[name]} className="row2">
              <span className="avatar">{initials(r[name]) || '#'}</span>
              <div className="grow">
                {onOpen ? <button className="chip" style={{ padding: '2px 10px' }} onClick={() => onOpen(r[id])}>{r[name]}</button> : <b>{r[name]}</b>}
                <div className="meta">{r.total_reviews} reviews</div>
              </div>
              <div><Stars rating={r.avg_rating} /><div className="meta" style={{ textAlign: 'right' }}>{Number(r.avg_rating).toFixed(2)}</div></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

async function fetchAdminTrips(api, status, offset, limit) {
  let remote = [];
  let remoteError = null;
  try {
    remote = status
      ? (await api(`/api/trips/status/${status}`)).data.trips || []
      : (await api('/api/trips?limit=200&offset=0')).data.trips || [];
  } catch (e) { remoteError = e; }

  const local = allLocalTrips();
  const merged = [...remote, ...local.filter((l) => !remote.some((r) => String(r.trip_id) === String(l.trip_id)))];
  const filtered = status ? merged.filter((t) => String(t.status || '').toUpperCase() === status) : merged;
  if (remoteError && !local.length) throw remoteError;
  return filtered.slice(offset, offset + limit);
}

function Trips({ api, status, setStatus, offset, setOffset, onSelectTrip }) {
  const limit = 10;
  const [dlg, setDlg] = useState(null); const [rev, setRev] = useState(0); const [local, setLocal] = useState(false);
  const { data, error, loading } = useLoad(() => fetchAdminTrips(api, status, offset, limit), [api, status, offset, rev]);
  const trips = useMemo(() => data && withOverlay('trips', data, 'trip_id'), [data, rev]);
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'sm_trip_sync' || e.key?.startsWith('sm_client_trips_')) setRev((r) => r + 1);
    };
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(() => setRev((r) => r + 1), 15000);
    return () => { window.removeEventListener('storage', onStorage); window.clearInterval(timer); };
  }, []);
  const toInput = (d) => { const x = new Date(d); return Number.isNaN(+x) ? '' : new Date(x - x.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); };
  return (
    <>
      <Head title="Trips & bookings">Staff service and on-demand trips. Select a trip for its journey, or use the row actions to edit or delete it.</Head>
      <LocalNote on={local} res="trips" />
      <div className="tools">
        {TRIP_STATUSES.map((v) => (
          <button key={v || 'all'} className="chip" type="button" aria-pressed={status === v} onClick={() => setStatus(v)}>{v ? v.replace('_', ' ') : 'All'}</button>
        ))}
      </div>
      {error ? <ErrorMessage message={error} /> : (
        <section className="card tbl" aria-live="polite">
          {loading ? <div className="empty">Loading...</div> : !trips?.length ? <div className="empty">No trips found for this filter.</div> : (
            <table>
              <thead><tr><th>Trip</th><th>Customer</th><th>Date</th><th>Status</th><th>Driver</th><th>Vehicle</th><th>Actions</th></tr></thead>
              <tbody>
                {trips.map((t) => (
                  <tr key={t.trip_id} className="row" tabIndex="0" onClick={() => onSelectTrip(t.trip_id)}
                    onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelectTrip(t.trip_id); } }}>
                    <td><b>{t.trip_id}</b></td>
                    <td><div><b>{t.client_name || t.customer_name || t.client_email || t.passenger_id || '-'}</b>{t.client_email && t.client_name && <div className="meta">{t.client_email}</div>}</div></td>
                    <td>{formatDate(t.trip_date)}</td><td><Tag status={t.status} /></td>
                    <td><span className="row2"><span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(t.driver_name)}</span>{t.driver_name || 'Unassigned'}</span></td>
                    <td>{t.vehicle_registration || 'Unassigned'}</td>
                    <RowActions onEdit={() => setDlg({ mode: 'edit', row: { ...t, trip_date: toInput(t.trip_date), label: `Trip ${t.trip_id}` } })} onDelete={() => setDlg({ mode: 'delete', row: { ...t, label: `Trip ${t.trip_id}` } })} />
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {!status && !error && (
        <div className="tools" style={{ marginTop: 14 }}>
          <button className="btn" type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
          <button className="btn" type="button" disabled={(trips?.length || 0) < limit} onClick={() => setOffset(offset + limit)}>Next</button>
          <span className="meta">{trips?.length ? `Showing ${offset + 1}-${offset + trips.length}` : 'No trips'}</span>
        </div>
      )}
      <CrudDialogs key={dlg ? `${dlg.mode}-${dlg.row.trip_id}` : 'x'} dlg={dlg} setDlg={setDlg} res="trips" k="trip_id" noun="trip"
        fields={[{ name: 'trip_date', label: 'Date & time', type: 'datetime-local' }, { name: 'status', label: 'Status', options: TRIP_STATUSES.slice(1) }, { name: 'driver_name', label: 'Driver' }, { name: 'vehicle_registration', label: 'Vehicle registration' }]}
        onDone={(l) => { setLocal(l); setRev((r) => r + 1); }} />
    </>
  );
}

function TripDialog({ api, tripId, rates, onClose, onReview }) {
  const { data: trip, error } = useLoad(async () => {
    try { return (await api(`/api/trips/${encodeURIComponent(tripId)}`)).data.trip; }
    catch (e) {
      const local = allLocalTrips().find((t) => String(t.trip_id) === String(tripId));
      if (local) return local;
      throw e;
    }
  }, [api, tripId]);
  return (
    <Modal onClose={onClose}>
      {error ? <ErrorMessage message={error} /> : !trip ? 'Loading...' : (
        <>
          <h2>Trip {trip.trip_id}</h2><Tag status={trip.status} />
          <dl>
            <dt>Journey</dt><dd>{trip.journey}</dd>
            <dt>Date</dt><dd>{formatDate(trip.trip_date)}</dd>
            <dt>Type</dt><dd>{trip.trip_type.replace('_', ' ').toLowerCase()}</dd>
            <dt>Driver</dt><dd>{trip.driver_name}</dd>
            <dt>Vehicle</dt><dd>{trip.vehicle_registration} ({trip.seat_capacity} seats)</dd>
            <dt>Rate</dt><dd>{lkr(rates[vType(trip.seat_capacity)])} per km <span className="meta">(rate card)</span></dd>
          </dl>
          <div className="tools">
            <button className="btn primary" type="button" onClick={() => onReview(trip.trip_id)}>Review this trip</button>
            <button className="btn" type="button" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function ResourceDialog({ noun, mode, row, fields, onClose, onSubmit, onDelete }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setErr('');
    try { const f = new FormData(e.currentTarget); const body = Object.fromEntries(fields.map(({ name, type }) => [name, type === 'number' ? Number(f.get(name)) : String(f.get(name)).trim()])); await onSubmit(body); onClose(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return <Modal onClose={onClose}>
    {mode === 'delete' ? <>
      <h2>Delete {noun}?</h2><p style={{ margin: '8px 0 16px' }}><b>{row.label}</b> will be removed.</p>
      {err && <ErrorMessage message={err} />}
      <div className="tools"><button className="btn danger" type="button" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete(); onClose(); } catch (e) { setErr(e.message); } finally { setBusy(false); } }}>{busy ? 'Deleting...' : 'Delete'}</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div>
    </> : <form onSubmit={submit}>
      <h2>{mode === 'create' ? `Add ${noun}` : `Edit ${noun}`}</h2>
      {fields.map(({ name, label, type='text', options, placeholder }) => <label key={name}>{label}
        {options ? <select name={name} defaultValue={row?.[name] ?? options[0]} required>{options.map(o => <option key={o} value={o}>{o}</option>)}</select>
          : <input name={name} type={type} defaultValue={row?.[name] ?? ''} placeholder={placeholder} required />}
      </label>)}
      {err && <ErrorMessage message={err} />}
      <div className="tools" style={{ marginTop: 16 }}><button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : mode === 'create' ? `Add ${noun}` : 'Save changes'}</button><button className="btn" type="button" onClick={onClose}>Cancel</button></div>
    </form>}
  </Modal>;
}

function Drivers({ sample, top, openLookup }) {
  const [q, setQ] = useState(''); const [dlg, setDlg] = useState(null); const [rev, setRev] = useState(0); const [local, setLocal] = useState(false);
  const list = useMemo(() => {
    const m = new Map();
    (sample.data || []).forEach((t) => {
      if (!t.driver_name) return;
      const d = m.get(t.driver_name) || { key: t.driver_name, name: t.driver_name, trips: 0, done: 0, active: false };
      d.trips++; if (String(t.status).toUpperCase() === 'COMPLETED') d.done++; if (String(t.status).toUpperCase() === 'IN_PROGRESS') d.active = true; m.set(t.driver_name, d);
    });
    (top.data?.top_drivers || []).forEach((r) => { const key = r.driver_name || r.name || r.driver_id; const d = m.get(key) || { key, name: r.driver_name || r.name || `Driver ${r.driver_id}`, trips: 0, done: 0, active: false }; Object.assign(d, { id: r.driver_id, remoteId: r.driver_id, rating: r.avg_rating, reviews: r.total_reviews }); m.set(key, d); });
    newRows('drivers').forEach((r) => { const key = r.key || r.driver_id || r.id || r.name; const old = m.get(key); m.set(key, { trips: 0, done: 0, active: false, phone: '', status: 'Available', ...old, ...r, key, name: r.name || old?.name || key }); });
    return withOverlay('drivers', [...m.values()].map(d => ({ phone: '', status: d.active ? 'On a trip' : 'Available', ...d })), 'key').filter(d => String(d.name).toLowerCase().includes(q.toLowerCase())).sort((a,b) => b.trips-a.trips);
  }, [sample.data, top.data, q, rev]);
  const stTone = { 'On a trip': 'blue', Available: 'ok', 'On leave': 'warn', Inactive: 'bad' };
  async function add(body) {
    const key = body.driver_id || body.id || body.name;
    const result = await createResource('drivers', { ...body, driver_id: body.driver_id || undefined }, () => ({ ...body, key, id: `D-${Date.now()}`, driver_id: `D-${Date.now()}` }));
    setLocal(result.local); setRev(x => x + 1);
  }
  async function del(row) {
    if (row.localOnly || newRows('drivers').some(r => (r.key || r.driver_id || r.id || r.name) === row.key)) { removeNewRow('drivers', r => (r.key || r.driver_id || r.id || r.name) === row.key); const o = jget('sm_ov_drivers', { edits:{}, deleted:[] }); o.deleted=[...new Set([...(o.deleted||[]), row.key])]; jset('sm_ov_drivers', o); setRev(x=>x+1); return; }
    const isLocal = await mutate('drivers', 'DELETE', row.key, undefined, row.remoteId); setLocal(isLocal); setRev(x=>x+1);
  }
  return <>
    <Head title="Drivers">Manage drivers, contact details and availability for your fleet.</Head>
    <div className="tools"><input className="search" aria-label="Search drivers" placeholder="Search drivers" value={q} onChange={e=>setQ(e.target.value)} /><button className="btn primary" type="button" onClick={()=>setDlg({mode:'create',row:{status:'Available'}})}>+ Add driver</button></div>
    <LocalNote on={local} res="drivers" />
    {sample.error && <ErrorMessage message={sample.error} />}
    {!sample.loading && !list.length && !sample.error && <div className="empty">No drivers yet. Use <b>+ Add driver</b> to create the first driver.</div>}
    {!!list.length && <section className="card tbl"><table><thead><tr><th>Driver</th><th>Phone</th><th>Status</th><th>Trips</th><th>Completed</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{list.map(d=><tr key={d.key}>
      <td><span className="row2"><span className="avatar" style={{width:30,height:30,fontSize:12}}>{initials(d.name)}</span>{d.id ? <button className="chip" style={{padding:'2px 10px'}} onClick={()=>openLookup('driver',d.id)}>{d.name}</button> : <b>{d.name}</b>}</span></td>
      <td>{d.phone || '-'}</td><td><span className={`tag ${stTone[d.status]||''}`}>{d.status}</span></td><td>{d.trips||0}</td><td>{d.trips?Math.round((d.done/d.trips)*100):0}%</td><td>{d.rating?Number(d.rating).toFixed(1):'-'}</td>
      <RowActions onEdit={()=>setDlg({mode:'edit',row:{...d,label:d.name}})} onDelete={()=>setDlg({mode:'delete',row:{...d,label:d.name}})} />
    </tr>)}</tbody></table></section>}
    {dlg && <ResourceDialog noun="driver" mode={dlg.mode} row={dlg.row} fields={[{name:'name',label:'Full name',placeholder:'e.g. Kasun Perera'},{name:'phone',label:'Phone',type:'tel',placeholder:'07X XXX XXXX'},{name:'status',label:'Status',options:['Available','On a trip','On leave','Inactive']}]} onClose={()=>setDlg(null)} onSubmit={async body=>{ if(dlg.mode==='create') await add(body); else { const l=await mutate('drivers','PUT',dlg.row.key,body,dlg.row.remoteId); setLocal(l); setRev(x=>x+1); } }} onDelete={()=>del(dlg.row)} />}
  </>;
}

function Vehicles({ sample, top, rates }) {
  const [q, setQ] = useState(''); const [dlg, setDlg] = useState(null); const [rev, setRev] = useState(0); const [local, setLocal] = useState(false);
  const list = useMemo(() => {
    const m = new Map();
    (sample.data || []).forEach(t => { if(!t.vehicle_registration) return; const v=m.get(t.vehicle_registration)||{key:t.vehicle_registration,reg:t.vehicle_registration,seats:t.seat_capacity,trips:0,active:false,next:false}; v.trips++; const st=String(t.status).toUpperCase(); if(st==='IN_PROGRESS')v.active=true; if(st==='SCHEDULED')v.next=true; m.set(t.vehicle_registration,v); });
    (top.data?.top_vehicles || []).forEach(r=>{const key=r.registration_no||r.registration||r.reg; const v=m.get(key)||{key,reg:key,seats:r.seat_capacity||r.seats,trips:0,active:false,next:false}; Object.assign(v,{id:r.vehicle_id,remoteId:r.vehicle_id,rating:r.avg_rating}); m.set(key,v);});
    newRows('vehicles').forEach(r=>{const key=r.key||r.registration_no||r.registration||r.reg||r.id; const old=m.get(key); m.set(key,{trips:0,active:false,next:false,status:'Idle',...old,...r,key,reg:r.reg||r.registration||r.registration_no||old?.reg||key,seats:Number(r.seats||r.seat_capacity||old?.seats||0)});});
    return withOverlay('vehicles',[...m.values()].map(v=>({status:v.active?'In service':v.next?'Scheduled':(v.status||'Idle'),...v})), 'key').filter(v=>String(v.reg).toLowerCase().includes(q.toLowerCase()));
  }, [sample.data, top.data, q, rev]);
  const stTone={ 'In service':'blue',Scheduled:'warn',Idle:'ok',Maintenance:'bad' };
  async function add(body){const key=body.reg; const result=await createResource('vehicles',{...body,registration_no:body.reg,seat_capacity:Number(body.seats)},()=>({ ...body,key,id:`V-${Date.now()}`,vehicle_id:`V-${Date.now()}`,registration_no:body.reg,registration:body.reg,seat_capacity:Number(body.seats),reg:body.reg,localOnly:true })); setLocal(result.local); setRev(x=>x+1);}
  async function del(row){if(row.localOnly||newRows('vehicles').some(r=>(r.key||r.registration_no||r.registration||r.reg||r.id)===row.key)){removeNewRow('vehicles',r=>(r.key||r.registration_no||r.registration||r.reg||r.id)===row.key); const o=jget('sm_ov_vehicles',{edits:{},deleted:[]}); o.deleted=[...new Set([...(o.deleted||[]),row.key])]; jset('sm_ov_vehicles',o); setRev(x=>x+1); return;} const isLocal=await mutate('vehicles','DELETE',row.key,undefined,row.remoteId); setLocal(isLocal); setRev(x=>x+1);}
  return <>
    <Head title="Vehicles">Manage registrations, capacity, service status and fleet availability.</Head>
    <div className="tools"><input className="search" aria-label="Search vehicles" placeholder="Search registration" value={q} onChange={e=>setQ(e.target.value)} /><button className="btn primary" type="button" onClick={()=>setDlg({mode:'create',row:{status:'Idle',seats:12}})}>+ Add vehicle</button></div>
    <LocalNote on={local} res="vehicles" />
    {sample.error && <ErrorMessage message={sample.error} />}
    {!sample.loading && !list.length && !sample.error && <div className="empty">No vehicles yet. Use <b>+ Add vehicle</b> to create the first vehicle.</div>}
    {!!list.length && <section className="card tbl"><table><thead><tr><th>Registration</th><th>Type</th><th>Seats</th><th>Status</th><th>Trips</th><th>Per km</th><th>Rating</th><th>Actions</th></tr></thead><tbody>{list.map(v=>{const t=vType(v.seats);return <tr key={v.key}><td><b>{v.reg}</b></td><td>{t==='BUS'?'Bus':'Van'}</td><td>{v.seats}</td><td><span className={`tag ${stTone[v.status]||''}`}>{v.status}</span></td><td>{v.trips}</td><td>{lkr(rates[t])}</td><td>{v.rating?Number(v.rating).toFixed(1):'-'}</td><RowActions onEdit={()=>setDlg({mode:'edit',row:{...v,reg:v.reg,seats:v.seats,label:v.reg}})} onDelete={()=>setDlg({mode:'delete',row:{...v,label:v.reg}})} /></tr>})}</tbody></table></section>}
    {dlg && <ResourceDialog noun="vehicle" mode={dlg.mode} row={dlg.row} fields={[{name:'reg',label:'Registration',placeholder:'e.g. WP CAA-1234'},{name:'seats',label:'Seat capacity',type:'number',placeholder:'12'},{name:'status',label:'Status',options:['Idle','In service','Scheduled','Maintenance']}]} onClose={()=>setDlg(null)} onSubmit={async body=>{ if(dlg.mode==='create') await add(body); else { const l=await mutate('vehicles','PUT',dlg.row.key,{...body,registration_no:body.reg,seat_capacity:Number(body.seats)},dlg.row.remoteId); setLocal(l); setRev(x=>x+1); } }} onDelete={()=>del(dlg.row)} />}
  </>;
}

function Clients({ api }) {
  const [q, setQ] = useState('');
  const { data, error, loading } = useLoad(() => api('/api/reviews?page=1&limit=100').then((r) => r.data.reviews), [api]);
  const list = useMemo(() => {
    const m = new Map();
    (data || []).forEach((r) => {
      const c = m.get(r.passenger_id) || { id: r.passenger_id, n: 0, sum: 0, complaints: 0, last: r.review_date };
      c.n++; c.sum += Number(r.rating) || 0; if (r.is_complaint) c.complaints++;
      if (new Date(r.review_date) > new Date(c.last)) c.last = r.review_date; m.set(r.passenger_id, c);
    });
    try {
      const clients = jget('sm_clients_local', []);
      clients.forEach((c) => {
        const old = m.get(c.id) || { id: c.id, n: 0, sum: 0, complaints: 0, last: null };
        m.set(c.id, { ...old, name: c.name, email: c.email, phone: c.phone, company: c.company, client_type: c.client_type });
      });
    } catch { /* browser storage only */ }
    return [...m.values()].filter((c) => `${c.id} ${c.name || ''} ${c.email || ''} ${c.company || ''}`.toLowerCase().includes(q.toLowerCase()));
  }, [data, q]);
  return (
    <>
      <Head title="Clients">Customer accounts and their bookings. Customer accounts created in this browser are also shown here.</Head>
      <div className="note">The current API has no passenger list yet, so this view is built from approved reviews. A full client directory with contact details needs a <code>/api/passengers</code> endpoint.</div>
      <div className="tools"><input className="search" aria-label="Search clients" placeholder="Search passenger ID" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {error ? <ErrorMessage message={error} /> : (
        <section className="card tbl" aria-live="polite">
          {loading ? <div className="empty">Loading...</div> : !list.length ? <div className="empty">No clients found.</div> : (
            <table><thead><tr><th>Customer</th><th>Contact</th><th>Reviews</th><th>Avg rating</th><th>Complaints</th><th>Last review</th></tr></thead>
              <tbody>{list.map((c) => (
                <tr key={c.id}><td><span className="row2"><span className="avatar" style={{ width: 30, height: 30, fontSize: 12 }}>{initials(c.name || String(c.id))}</span><div><b>{c.name || c.id}</b><div className="meta">{c.company || c.client_type || c.id}</div></div></span></td>
                  <td>{c.email || c.phone || '-'}</td><td>{c.n}</td><td><Stars rating={c.sum / c.n} /> <span className="meta">{(c.sum / c.n).toFixed(1)}</span></td>
                  <td>{c.complaints ? <span className="tag bad">{c.complaints}</span> : '0'}</td><td>{formatDate(c.last)}</td></tr>))}</tbody></table>
          )}
        </section>
      )}
    </>
  );
}

function Reviews({ api, page, setPage, onWriteReview }) {
  const [tab, setTab] = useState('all');
  const { data: result, error, loading } = useLoad(() => api(`/api/reviews?page=${page}&limit=6`).then((r) => r.data), [api, page]);
  return (
    <>
      <Head title="Reviews" action={tab === 'all' && <button className="btn primary" type="button" onClick={onWriteReview}>Write a review</button>}>Approved passenger reviews and complaints.</Head>
      <div className="tools">
        {[['all', 'All reviews'], ['complaints', 'Complaints']].map(([id, l]) => <button key={id} className="chip" type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{l}</button>)}
      </div>
      {tab === 'complaints' ? <Complaints api={api} /> : (
        <>
          {error ? <ErrorMessage message={error} /> : (
            <section className="card" aria-live="polite">
              {loading ? 'Loading...' : result.reviews.length ? result.reviews.map((r) => <ReviewCard key={r._id || `${r.trip_id}-${r.review_date}`} review={r} />) : <div className="empty">No approved reviews yet. Write the first one.</div>}
            </section>
          )}
          {result && !error && (
            <div className="tools" style={{ marginTop: 14 }}>
              <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <button className="btn" type="button" disabled={page >= result.pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
              <span className="meta">Page {result.pagination.page} of {result.pagination.pages || 1} · {result.pagination.total} reviews</span>
            </div>
          )}
        </>
      )}
    </>
  );
}

function ReviewDialog({ api, tripId, onClose }) {
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  async function submitReview(event) {
    event.preventDefault(); setError('');
    const f = new FormData(event.currentTarget);
    const body = { trip_id: String(f.get('trip_id')).trim(), passenger_id: String(f.get('passenger_id')).trim(), rating: String(f.get('rating')), review_title: String(f.get('review_title')).trim(), review_text: String(f.get('review_text')).trim() };
    if (!body.trip_id || !body.passenger_id || !body.review_text) { setError('Trip ID, passenger ID and review text are required.'); return; }
    setSending(true);
    try { await api('/api/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); setSubmitted(true); }
    catch (err) { setError(err.message); } finally { setSending(false); }
  }
  return (
    <Modal onClose={onClose}>
      {submitted ? (<><h2>Review submitted</h2><p style={{ margin: '8px 0 16px' }}>It will appear after moderation.</p><button className="btn" type="button" onClick={onClose}>Close</button></>) : (
        <form onSubmit={submitReview}>
          <h2>Write a review</h2>
          <label>Trip ID<input name="trip_id" defaultValue={tripId} required /></label>
          <label>Passenger ID<input name="passenger_id" required /></label>
          <label>Rating<select name="rating" defaultValue="5">{[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{r} - {'★'.repeat(r)}{'☆'.repeat(5 - r)}</option>)}</select></label>
          <label>Title<input name="review_title" /></label>
          <label>Your review<textarea name="review_text" rows="4" required /></label>
          {error && <div style={{ marginTop: 12 }}><ErrorMessage message={error} /></div>}
          <div className="tools" style={{ marginTop: 16 }}>
            <button className="btn primary" type="submit" disabled={sending}>{sending ? 'Submitting...' : 'Submit review'}</button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function Complaints({ api }) {
  const [keyword, setKeyword] = useState(''); const [type, setType] = useState(''); const [days, setDays] = useState('');
  const [result, setResult] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function search(event) {
    event.preventDefault(); setError('');
    const p = new URLSearchParams();
    if (keyword.trim()) p.set('q', keyword.trim()); if (type) p.set('type', type); if (days) p.set('days', days);
    if (!keyword.trim() && !type) { setError('Enter a keyword or choose a complaint type.'); return; }
    setLoading(true);
    try { setResult((await api(`/api/reviews/search?${p}`)).data); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  return (
    <>
      <form className="tools" onSubmit={search}>
        <input className="search" aria-label="Keyword" placeholder="Keyword" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select aria-label="Type" value={type} onChange={(e) => setType(e.target.value)}><option value="">Any type</option>{COMPLAINT_TYPES.map((v) => <option key={v}>{v}</option>)}</select>
        <select aria-label="Period" value={days} onChange={(e) => setDays(e.target.value)}><option value="">Any time</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option></select>
        <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </form>
      {error && <ErrorMessage message={error} />}
      {result && !error && (<>
        <p className="meta" style={{ marginBottom: 10 }}>{result.total_complaints} complaint(s) found</p>
        {result.complaints.length ? <section className="card">{result.complaints.map((r, i) => <ReviewCard key={r._id || `${r.trip_id}-${i}`} review={r} />)}</section> : <div className="empty">No complaints match. Try a broader search.</div>}
      </>)}
    </>
  );
}

function Lookup({ api, initial }) {
  const [kind, setKind] = useState(initial?.kind || 'route'); const [id, setId] = useState(initial?.id || '');
  const [data, setData] = useState(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  async function run(k, v) {
    setError(''); setData(null);
    if (!String(v).trim()) { setError('Enter an ID first.'); return; }
    setLoading(true);
    try { setData((await api(`/api/reviews/${k}/${encodeURIComponent(String(v).trim())}`)).data); } catch (err) { setError(err.message); } finally { setLoading(false); }
  }
  useEffect(() => { if (initial?.id) run(initial.kind, initial.id); /* eslint-disable-next-line */ }, [initial]);
  const stats = data?.statistics; const entity = data?.[kind];
  return (
    <>
      <Head title="Route & driver lookup">See reviews and rating statistics for one route or driver.</Head>
      <form className="tools" onSubmit={(e) => { e.preventDefault(); run(kind, id); }}>
        <select aria-label="Lookup type" value={kind} onChange={(e) => setKind(e.target.value)}><option value="route">Route</option><option value="driver">Driver</option></select>
        <input className="search" aria-label="ID" placeholder="ID, e.g. R001" value={id} onChange={(e) => setId(e.target.value)} />
        <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Looking up...' : 'Look up'}</button>
      </form>
      {error && <ErrorMessage message={error} />}
      {data && entity && stats && (
        <div className="grid">
          <section className="card">
            <h3>{entity.name}</h3>
            <p className="meta" style={{ marginBottom: 14 }}>{kind === 'route' ? `${entity.totalDistance} km` : `${entity.status} · hired ${formatDate(entity.hireDate)}`}</p>
            <div className="stat"><div><b>{(stats.avg_rating || 0).toFixed(2)}</b>Average rating</div><div><b>{stats.total_reviews}</b>Reviews</div><div><b>{stats.complaints ?? 0}</b>Complaints</div></div>
          </section>
          <section className="card">{data.reviews.length ? data.reviews.map((r, i) => <ReviewCard key={r._id || `${r.trip_id}-${i}`} review={r} />) : <div className="empty">No approved reviews yet.</div>}</section>
        </div>
      )}
    </>
  );
}

function Rates({ rates, saveRates }) {
  const [type, setType] = useState('VAN'); const [km, setKm] = useState(25); const [days, setDays] = useState(1);
  const total = km * days * rates[type];
  return (
    <>
      <Head title="Rates (LKR)">Per-kilometre rates in Sri Lankan rupees, and a quick fare estimator.</Head>
      <div className="note">These rates are saved in this browser only. Your backend does not expose <code>RatePerKm</code> yet, so edit them to match your database.</div>
      <div className="grid g2">
        <section className="card">
          <h3>Rate card</h3>
          {['VAN', 'BUS'].map((t) => (
            <label key={t}>{t === 'VAN' ? 'Van' : 'Bus'} (Rs. per km)
              <input type="number" min="0" value={rates[t]} onChange={(e) => saveRates({ ...rates, [t]: Number(e.target.value) })} /></label>
          ))}
          <p className="meta" style={{ marginTop: 12 }}>Vehicles with 20 or more seats are treated as buses.</p>
        </section>
        <section className="card">
          <h3>Fare estimator</h3>
          <label>Vehicle<select value={type} onChange={(e) => setType(e.target.value)}><option value="VAN">Van</option><option value="BUS">Bus</option></select></label>
          <label>Distance per trip (km)<input type="number" min="0" value={km} onChange={(e) => setKm(Number(e.target.value))} /></label>
          <label>Number of trips (e.g. working days)<input type="number" min="1" value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
          <div style={{ marginTop: 18 }}><div className="meta">Estimated cost</div><div className="big">{lkr(total)}</div></div>
        </section>
      </div>
    </>
  );
}
