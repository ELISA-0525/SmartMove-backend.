import { useEffect, useMemo, useState } from 'react';
import { send, tryApi, jget, jset } from '../shared.js';

const SK = 'sm_client_session', CK = 'sm_clients_local', TK = (id) => `sm_client_trips_${id}`;
const STATUSES = ['', 'REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const tone = (s) => ({ COMPLETED: 'ok', IN_PROGRESS: 'blue', SCHEDULED: 'warn', REQUESTED: 'warn', CANCELLED: 'bad' }[s] || '');
const Tag = ({ status }) => <span className={`tag ${tone(status)}`}>{String(status).replace('_', ' ')}</span>;
const Msg = ({ children }) => children ? <div className="msg" role="alert">{children}</div> : null;
const hash = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const strip = ({ pw, password, ...c }) => c;
const form = (e) => Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]));

/* ---------- API logic (real endpoint first, browser fallback if the backend lacks it) ---------- */
async function register(f) {
  const { data } = await tryApi(() => send('/api/clients/register', 'POST', f).then((r) => r.data), async () => {
    const all = jget(CK, []); const email = f.email.toLowerCase();
    if (all.some((c) => c.email === email)) throw new Error('An account with this email already exists.');
    const c = { ...strip(f), email, id: `C-${Date.now()}`, pw: await hash(f.password) };
    jset(CK, [...all, c]); return { client: strip(c), token: null };
  });
  return data;
}
async function login({ email, password }) {
  const { data } = await tryApi(() => send('/api/clients/login', 'POST', { email, password }).then((r) => r.data), async () => {
    const c = jget(CK, []).find((x) => x.email === email.toLowerCase());
    if (!c || c.pw !== await hash(password)) throw new Error('Incorrect email or password.');
    return { client: strip(c), token: null };
  });
  return data;
}
async function saveProfile({ client, token }, body) {
  const { data } = await tryApi(() => send(`/api/clients/${client.id}`, 'PUT', body, token).then((r) => r.data.client), () => {
    jset(CK, jget(CK, []).map((c) => (c.id === client.id ? { ...c, ...body } : c))); return { ...client, ...body };
  });
  return data;
}
async function fetchTrips({ client, token }) {
  const cached = jget(TK(client.id), []);
  const { data } = await tryApi(() => send(`/api/clients/${client.id}/trips`, 'GET', undefined, token).then((r) => r.data.trips), () => []);
  return [...cached, ...data.filter((t) => !cached.some((c) => c.trip_id === t.trip_id))];
}
async function bookTrip({ client, token }, body) {
  const { data } = await tryApi(() => send('/api/trips', 'POST', { ...body, client_id: client.id }, token).then((r) => r.data.trip), () => null);
  const trip = { trip_id: `REQ-${Date.now().toString().slice(-6)}`, status: 'REQUESTED', ...data, ...body, journey: `${body.pickup} → ${body.dropoff}` };
  jset(TK(client.id), [trip, ...jget(TK(client.id), [])]); return trip;
}
const lookupTrip = (id) => send(`/api/trips/${encodeURIComponent(id)}`).then((r) => r.data.trip); // existing endpoint

/* ---------- Root ---------- */
export default function Portal() {
  const [session, setSession] = useState(() => jget(SK, null));
  const update = (s) => { setSession(s); jset(SK, s); };
  return session ? <Dash session={session} setSession={update} /> : <Auth onAuth={update} />;
}

/* ---------- Login / Register ---------- */
function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'); const [kind, setKind] = useState('INDIVIDUAL');
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(''); const f = form(e);
    if (mode === 'register' && f.password.length < 8) return setErr('Use a password of at least 8 characters.');
    setBusy(true);
    try { onAuth(await (mode === 'login' ? login(f) : register({ ...f, client_type: kind }))); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <div className="auth">
      <aside>
        <div className="brand" style={{ color: '#fff' }}><span className="mark" style={{ background: 'var(--yellow)', color: 'var(--navy)' }}>SM</span>SmartMove</div>
        <h2>Book, track and manage your trips.</h2>
        <p>Request staff service or on-demand vehicles, follow every trip from scheduled to completed, and keep your company details up to date.</p>
      </aside>
      <div className="pane">
        <form onSubmit={submit} key={mode}>
          <h1 style={{ fontSize: 26 }}>{mode === 'login' ? 'Client sign in' : 'Create client account'}</h1>
          <p className="sub" style={{ marginBottom: 8 }}>{mode === 'login' ? 'Welcome back.' : 'Individuals and companies are both welcome.'}</p>
          {mode === 'register' && (
            <>
              <div className="tools" style={{ marginTop: 14, marginBottom: 0 }}>
                {[['INDIVIDUAL', 'Individual'], ['CORPORATE', 'Corporate']].map(([v, l]) => <button key={v} type="button" className="chip" aria-pressed={kind === v} onClick={() => setKind(v)}>{l}</button>)}
              </div>
              <label>Full name<input name="name" required autoComplete="name" /></label>
              {kind === 'CORPORATE' && <label>Company name<input name="company" required /></label>}
              <label>Phone<input name="phone" type="tel" required autoComplete="tel" /></label>
            </>
          )}
          <label>Email<input name="email" type="email" required autoComplete="email" /></label>
          <label>Password<input name="password" type="password" required autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /></label>
          <div style={{ marginTop: 14 }}><Msg>{err}</Msg></div>
          <button className="btn primary" type="submit" disabled={busy} style={{ width: '100%', marginTop: 6 }}>{busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
          <p className="meta" style={{ marginTop: 16, textAlign: 'center' }}>
            {mode === 'login' ? 'New to SmartMove? ' : 'Already registered? '}
            <button type="button" className="chip" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); setBusy(false); }}>{mode === 'login' ? 'Create an account' : 'Sign in'}</button>
          </p>
        </form>
      </div>
    </div>
  );
}

/* ---------- Client dashboard ---------- */
function Dash({ session, setSession }) {
  const { client } = session; const [tab, setTab] = useState('overview');
  const [trips, setTrips] = useState([]); const [rev, setRev] = useState(0); const [loadErr, setLoadErr] = useState('');
  useEffect(() => { fetchTrips(session).then((t) => { setTrips(t); setLoadErr(''); }).catch((e) => setLoadErr(e.message)); /* eslint-disable-next-line */ }, [rev]);
  const NAV = [['overview', 'Overview'], ['book', 'Book a trip'], ['trips', 'My trips'], ['profile', 'Profile']];
  return (
    <div className="frame">
      <header className="top">
        <div className="brand"><span className="mark">SM</span>SmartMove</div>
        <nav className="nav" aria-label="Client navigation">
          {NAV.map(([id, l]) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)}>{l}</button>)}
        </nav>
        <span className="meta">{client.company || client.name}</span>
        <button className="btn" type="button" onClick={() => setSession(null)}>Sign out</button>
      </header>
      <Msg>{loadErr}</Msg>
      {tab === 'overview' && <Overview client={client} trips={trips} go={setTab} />}
      {tab === 'book' && <Book session={session} onBooked={() => { setRev(rev + 1); setTab('trips'); }} />}
      {tab === 'trips' && <MyTrips trips={trips} />}
      {tab === 'profile' && <Profile session={session} setSession={setSession} />}
    </div>
  );
}

function Overview({ client, trips, go }) {
  const n = (...s) => trips.filter((t) => s.includes(t.status)).length;
  const next = trips.filter((t) => ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS'].includes(t.status)).slice(0, 5);
  return (
    <>
      <div className="head"><div><h1>Hello, {client.name.split(' ')[0]}</h1><p className="sub">Here is what is happening with your trips.</p></div>
        <button className="btn primary" type="button" onClick={() => go('book')}>Book a trip</button></div>
      <div className="grid g4" style={{ marginBottom: 20 }}>
        {[['Upcoming', n('REQUESTED', 'SCHEDULED')], ['In progress', n('IN_PROGRESS')], ['Completed', n('COMPLETED')], ['Cancelled', n('CANCELLED')]].map(([l, v]) =>
          <section key={l} className="card kpi"><div className="lbl">{l}</div><div className="val">{v}</div></section>)}
      </div>
      <section className="card"><h3>Active & upcoming</h3>
        {next.length ? next.map((t) => <div key={t.trip_id} className="row2" style={{ padding: '10px 0' }}><Tag status={t.status} /><b className="grow">{t.journey}</b><span className="meta">{fmt(t.trip_date)}</span></div>)
          : <div className="empty">No active trips. Book one to get started.</div>}
      </section>
    </>
  );
}

function Book({ session, onBooked }) {
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const min = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
  async function submit(e) {
    e.preventDefault(); setErr(''); const f = form(e);
    if (new Date(f.trip_date) < new Date()) return setErr('Pick a pickup time in the future.');
    setBusy(true);
    try { await bookTrip(session, { ...f, passengers: Number(f.passengers) }); onBooked(); }
    catch (x) { setErr(x.message); setBusy(false); }
  }
  return (
    <>
      <div className="head"><div><h1>Book a trip</h1><p className="sub">Tell us where and when. We will confirm a driver and vehicle.</p></div></div>
      <form onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="two">
          <label>Pickup location<input name="pickup" required /></label>
          <label>Drop-off location<input name="dropoff" required /></label>
          <label>Pickup date & time<input name="trip_date" type="datetime-local" min={min} required /></label>
          <label>Passengers<input name="passengers" type="number" min="1" max="60" defaultValue="1" required /></label>
          <label>Vehicle<select name="vehicle_type"><option value="VAN">Van (up to 19 seats)</option><option value="BUS">Bus (20+ seats)</option></select></label>
          <label>Trip type<select name="trip_type"><option value="ON_DEMAND">On demand</option><option value="STAFF_SERVICE">Staff service</option></select></label>
        </div>
        <label>Notes (optional)<textarea name="notes" rows="3" /></label>
        <div style={{ marginTop: 14 }}><Msg>{err}</Msg></div>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Sending...' : 'Request trip'}</button>
      </form>
    </>
  );
}

function MyTrips({ trips }) {
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [sel, setSel] = useState(null);
  const [err, setErr] = useState(''); const [looking, setLooking] = useState(false);
  const list = useMemo(() => trips.filter((t) => (!status || t.status === status) && `${t.trip_id} ${t.journey} ${t.driver_name || ''} ${t.vehicle_registration || ''}`.toLowerCase().includes(q.toLowerCase())), [trips, q, status]);
  async function lookup() { // GET /api/trips/:id
    setErr(''); setLooking(true);
    try { setSel(await lookupTrip(q.trim())); } catch (e) { setErr(e.message); } finally { setLooking(false); }
  }
  const steps = ['REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED'];
  return (
    <>
      <div className="head"><div><h1>My trips</h1><p className="sub">Search by trip ID, route, driver or vehicle. Select a trip to track it.</p></div></div>
      <div className="tools">
        <input className="search" aria-label="Search trips" placeholder="Search trips or enter a trip ID" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="button" disabled={!q.trim() || looking} onClick={lookup}>{looking ? 'Looking up...' : 'Look up trip ID'}</button>
      </div>
      <div className="tools">{STATUSES.map((v) => <button key={v || 'all'} type="button" className="chip" aria-pressed={status === v} onClick={() => setStatus(v)}>{v ? v.replace('_', ' ') : 'All'}</button>)}</div>
      <Msg>{err}</Msg>
      {sel && (
        <section className="card" aria-live="polite">
          <div className="row2"><h3 className="grow">Trip {sel.trip_id}</h3><Tag status={sel.status} /><button className="btn sm" type="button" onClick={() => setSel(null)}>Close</button></div>
          {steps.includes(sel.status) && <div className="steps" aria-hidden="true">{steps.map((s, i) => <i key={s} className={i <= steps.indexOf(sel.status) ? 'on' : ''} />)}</div>}
          <dl><dt>Journey</dt><dd>{sel.journey}</dd><dt>Pickup time</dt><dd>{fmt(sel.trip_date)}</dd>
            <dt>Driver</dt><dd>{sel.driver_name || 'To be assigned'}</dd><dt>Vehicle</dt><dd>{sel.vehicle_registration || 'To be assigned'}</dd></dl>
        </section>
      )}
      <section className="card tbl">
        {!list.length ? <div className="empty">No trips match. Try a different search or filter.</div> : (
          <table>
            <thead><tr><th>Trip</th><th>Journey</th><th>Pickup</th><th>Status</th></tr></thead>
            <tbody>{list.map((t) => (
              <tr key={t.trip_id} className="row" tabIndex="0" onClick={() => setSel(t)} onKeyDown={(e) => { if (e.key === 'Enter') setSel(t); }}>
                <td><b>{t.trip_id}</b></td><td>{t.journey}</td><td>{fmt(t.trip_date)}</td><td><Tag status={t.status} /></td>
              </tr>))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}

function Profile({ session, setSession }) {
  const { client } = session; const [msg, setMsg] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try { setSession({ ...session, client: await saveProfile(session, form(e)) }); setMsg('Profile updated.'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="head"><div><h1>Profile</h1><p className="sub">{client.client_type === 'CORPORATE' ? 'Corporate account' : 'Individual account'} · {client.email}</p></div></div>
      <form onSubmit={submit} style={{ maxWidth: 640 }}>
        <div className="two">
          <label>Full name<input name="name" defaultValue={client.name} required /></label>
          <label>Phone<input name="phone" type="tel" defaultValue={client.phone} required /></label>
          {client.client_type === 'CORPORATE' && <label>Company name<input name="company" defaultValue={client.company} required /></label>}
          <label>Billing / office address<input name="address" defaultValue={client.address || ''} /></label>
        </div>
        <div style={{ marginTop: 14 }}><Msg>{err}</Msg>{msg && <div className="note">{msg}</div>}</div>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button>
      </form>
    </>
  );
}
