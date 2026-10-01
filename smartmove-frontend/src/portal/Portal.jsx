import { useEffect, useMemo, useState } from 'react';
import { send, tryApi, jget, jset, newRows, mutate, syncLocalTrip, withOverlay } from '../shared.js';

const SK = 'sm_client_session', CK = 'sm_clients_local', TK = (id) => `sm_client_trips_${id}`;
const STATUSES = ['', 'REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const DEFAULT_VEHICLES = [
  { vehicle_id: 'DEMO-VAN-01', registration_no: 'SM-VAN-01', registration: 'SM-VAN-01', type: 'VAN', seat_capacity: 12, seats: 12, status: 'AVAILABLE', rate: 120, features: ['Air conditioned', 'Comfortable seats'] },
  { vehicle_id: 'DEMO-VAN-02', registration_no: 'SM-VAN-02', registration: 'SM-VAN-02', type: 'VAN', seat_capacity: 18, seats: 18, status: 'AVAILABLE', rate: 120, features: ['Air conditioned', 'Large luggage space'] },
  { vehicle_id: 'DEMO-BUS-01', registration_no: 'SM-BUS-01', registration: 'SM-BUS-01', type: 'BUS', seat_capacity: 40, seats: 40, status: 'AVAILABLE', rate: 65, features: ['Air conditioned', 'Large group seating'] },
];
const fmt = (d) => (d ? new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const money = (n) => `Rs. ${Math.round(Number(n) || 0).toLocaleString('en-LK')}`;
const tone = (s) => ({ COMPLETED: 'ok', IN_PROGRESS: 'blue', SCHEDULED: 'warn', REQUESTED: 'warn', CANCELLED: 'bad' }[String(s).toUpperCase()] || '');
const Tag = ({ status }) => <span className={`tag ${tone(status)}`}>{String(status || '').replaceAll('_', ' ')}</span>;
const Msg = ({ children }) => children ? <div className="msg" role="alert">{children}</div> : null;
const hash = async (t) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const strip = ({ pw, password, ...c }) => c;
const form = (e) => Object.fromEntries([...new FormData(e.currentTarget)].map(([k, v]) => [k, String(v).trim()]));

async function register(f) {
  const { data } = await tryApi(() => send('/api/clients/register', 'POST', f).then(r => r.data), async () => {
    const all = jget(CK, []); const email = f.email.toLowerCase();
    if (all.some(c => c.email === email)) throw new Error('An account with this email already exists.');
    const c = { ...strip(f), email, id: `C-${Date.now()}`, pw: await hash(f.password) }; jset(CK, [...all, c]); return { client: strip(c), token: null };
  }); return data;
}
async function login({ email, password }) {
  const { data } = await tryApi(() => send('/api/clients/login', 'POST', { email, password }).then(r => r.data), async () => {
    const c = jget(CK, []).find(x => x.email === email.toLowerCase());
    if (!c || c.pw !== await hash(password)) throw new Error('Incorrect email or password.'); return { client: strip(c), token: null };
  }); return data;
}
async function saveProfile({ client, token }, body) {
  const { data } = await tryApi(() => send(`/api/clients/${client.id}`, 'PUT', body, token).then(r => r.data.client), () => {
    jset(CK, jget(CK, []).map(c => c.id === client.id ? { ...c, ...body } : c)); return { ...client, ...body };
  }); return data;
}

function normalizeVehicle(v) {
  const seats = Number(v.seat_capacity ?? v.seats ?? v.capacity ?? 0);
  const reg = v.registration_no ?? v.registration ?? v.reg ?? v.vehicle_registration ?? '';
  return { ...v, vehicle_id: v.vehicle_id ?? v.id ?? reg, registration_no: reg, registration: reg, seats, seat_capacity: seats, type: v.type ?? (seats >= 20 ? 'BUS' : 'VAN'), status: String(v.status ?? 'AVAILABLE').toUpperCase(), rate: Number(v.rate ?? v.rate_per_km ?? (seats >= 20 ? 65 : 120)) };
}
async function fetchVehicles() {
  let remote = [];
  try {
    const r = await send('/api/vehicles');
    const data = r.data?.vehicles ?? r.vehicles ?? r.data ?? [];
    remote = Array.isArray(data) ? data : [];
  } catch {
    // If backend is unreachable or returns an error, use default vehicles
  }
  const local = newRows('vehicles');
  const merged = [...remote, ...local, ...DEFAULT_VEHICLES].map(normalizeVehicle);
  const map = new Map();
  for (const v of merged) {
    const key = v.registration_no || v.vehicle_id;
    if (key) map.set(String(key), v);
  }
  // Apply admin edits/deletions as well as newly-created vehicles so the
  // customer always sees the same fleet state as the admin portal.
  const fleet = [...map.values()].map((v) => ({ ...v, key: v.registration_no || v.vehicle_id }));
  const rows = withOverlay('vehicles', fleet, 'key');
  return rows.filter((v) => !['DELETED'].includes(String(v.status).toUpperCase()));
}

async function fetchTrips({ client, token }) {
  const cached = jget(TK(client.id), []);
  const { data } = await tryApi(() => send(`/api/clients/${client.id}/trips`, 'GET', undefined, token).then(r => r.data.trips), () => []);
  const remote = Array.isArray(data) ? data : [];
  const merged = [...remote, ...cached.filter(c => !remote.some(r => String(r.trip_id) === String(c.trip_id)))];
  return merged.sort((a, b) => new Date(b.trip_date || 0) - new Date(a.trip_date || 0));
}
async function bookTrip({ client, token }, body) {
  const generatedId = `TRP${Date.now().toString().slice(-6)}`;
  const payload = {
    ...body,
    trip_id: generatedId,
    status: 'SCHEDULED',
    client_id: client.id,
    passenger_id: client.id,
    client_name: client.name,
    client_email: client.email,
    customer_name: client.name,
    pickup: body.pickup,
    dropoff: body.dropoff,
    vehicle_registration: body.vehicle_registration,
    vehicle_id: body.vehicle_id,
    trip_date: body.trip_date
  };

  let backendTrip = null;
  try {
    const res = await send('/api/trips', 'POST', payload);
    backendTrip = res.data?.trip || res.trip || res.data;
  } catch (err) {
    console.warn('Backend API trip booking notice:', err.message);
  }

  const trip = {
    trip_id: backendTrip?.trip_id || payload.trip_id || `REQ-${Date.now().toString().slice(-6)}`,
    status: backendTrip?.status || 'SCHEDULED',
    ...backendTrip,
    ...body,
    client_id: client.id,
    passenger_id: client.id,
    client_name: client.name,
    client_email: client.email,
    customer_name: client.name,
    journey: backendTrip?.journey || `${body.pickup} → ${body.dropoff}`,
  };
  jset(TK(client.id), [trip, ...jget(TK(client.id), [])]);
  syncLocalTrip(trip.trip_id, trip);
  return trip;
}
async function cancelTrip(session, trip) {
  const { client, token } = session;
  const { local } = await tryApi(() => send(`/api/trips/${encodeURIComponent(trip.trip_id)}`, 'PUT', { status: 'CANCELLED' }, token), () => null);
  const next = jget(TK(client.id), []).map(t => t.trip_id === trip.trip_id ? { ...t, status: 'CANCELLED' } : t);
  jset(TK(client.id), next);
  syncLocalTrip(trip.trip_id, { status: 'CANCELLED' });
  return local;
}
const lookupTrip = (id) => send(`/api/trips/${encodeURIComponent(id)}`).then(r => r.data.trip);

export default function Portal() {
  const [session, setSession] = useState(() => jget(SK, null));
  const update = (s) => { setSession(s); jset(SK, s); };
  return session ? <Dash session={session} setSession={update} /> : <Auth onAuth={update} />;
}

function Auth({ onAuth }) {
  const [mode, setMode] = useState('login'); const [kind, setKind] = useState('INDIVIDUAL'); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function submit(e) { e.preventDefault(); setErr(''); const f=form(e); if(mode==='register' && f.password.length<8)return setErr('Use a password of at least 8 characters.'); setBusy(true); try{onAuth(await (mode==='login'?login(f):register({...f,client_type:kind})));}catch(x){setErr(x.message);setBusy(false);} }
  return <div className="auth client-auth">
    <aside><div className="brand" style={{color:'#fff'}}><span className="mark" style={{background:'var(--yellow)',color:'var(--navy)'}}>SM</span>SmartMove</div><span className="portal-badge">CUSTOMER PORTAL</span><h2>Your journey, your way.</h2><p>Schedule a vehicle, choose the right capacity, see your estimated fare and track every booking from one customer dashboard.</p><div className="portal-points"><span>✓ Choose a vehicle</span><span>✓ Schedule ahead</span><span>✓ Track your trip</span><span>✓ Manage your profile</span></div></aside>
    <div className="pane"><form onSubmit={submit}><h1 style={{fontSize:26}}>{mode==='login'?'Customer sign in':'Create customer account'}</h1><p className="sub" style={{marginBottom:8}}>{mode==='login'?'Access your bookings and schedule a new trip.':'Create an individual or corporate customer account.'}</p>
      {mode==='register'&&<><div className="tools" style={{marginTop:14,marginBottom:0}}>{[['INDIVIDUAL','Individual'],['CORPORATE','Corporate']].map(([v,l])=><button key={v} type="button" className="chip" aria-pressed={kind===v} onClick={()=>setKind(v)}>{l}</button>)}</div><label>Full name<input name="name" required autoComplete="name" /></label>{kind==='CORPORATE'&&<label>Company name<input name="company" required /></label>}<label>Phone<input name="phone" type="tel" required autoComplete="tel" /></label></>}
      <label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required autoComplete={mode==='login'?'current-password':'new-password'} /></label><Msg>{err}</Msg><button className="btn primary" type="submit" disabled={busy} style={{width:'100%',marginTop:6}}>{busy?'Please wait...':mode==='login'?'Sign in':'Create account'}</button>
      <p className="meta" style={{marginTop:16,textAlign:'center'}}>{mode==='login'?'New to SmartMove? ':'Already registered? '}<button type="button" className="chip" onClick={()=>{setMode(mode==='login'?'register':'login');setErr('');setBusy(false);}}>{mode==='login'?'Create an account':'Sign in'}</button></p>
    </form></div>
  </div>;
}

function Dash({ session, setSession }) {
  const { client } = session; const [tab,setTab]=useState('overview'); const [trips,setTrips]=useState([]); const [vehicles,setVehicles]=useState([]); const [rev,setRev]=useState(0); const [loadErr,setLoadErr]=useState('');
  useEffect(()=>{
    let active = true;
    const load = () => Promise.all([fetchTrips(session), fetchVehicles()]).then(([t,v])=>{
      if (!active) return;
      setTrips(t); setVehicles(v); setLoadErr('');
    }).catch(e=>active && setLoadErr(e.message));
    load();
    const onStorage = (e) => {
      if (e.key === 'sm_trip_sync' || e.key === 'sm_ov_vehicles' || e.key === 'sm_new_vehicles') load();
    };
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(load, 15000);
    return () => { active = false; window.removeEventListener('storage', onStorage); window.clearInterval(timer); };
  },[rev,session.client.id]);
  const NAV=[['overview','Dashboard'],['book','Schedule a trip'],['trips','My bookings'],['profile','My profile']];
  return <div className="client-portal"><header className="portal-top"><div className="brand"><span className="mark">SM</span>SmartMove <span className="portal-label">CUSTOMER</span></div><nav className="portal-nav">{NAV.map(([id,l])=><button key={id} type="button" aria-current={tab===id?'page':undefined} onClick={()=>setTab(id)}>{l}</button>)}</nav><div className="portal-user"><span>{client.company||client.name}</span><button className="btn" type="button" onClick={()=>{setSession(null);localStorage.removeItem(SK)}}>Sign out</button></div></header>
    <main className="portal-main"><Msg>{loadErr}</Msg>{tab==='overview'&&<Overview client={client} trips={trips} vehicles={vehicles} go={setTab}/>} {tab==='book'&&<Book session={session} vehicles={vehicles} onBooked={()=>{setRev(r=>r+1);setTab('trips')}}/>} {tab==='trips'&&<MyTrips session={session} trips={trips} onChanged={()=>setRev(r=>r+1)} onBook={()=>setTab('book')}/>} {tab==='profile'&&<Profile session={session} setSession={setSession}/>}</main>
  </div>;
}

function Overview({ client, trips, vehicles, go }) {
  const n=(...s)=>trips.filter(t=>s.includes(String(t.status).toUpperCase())).length; const next=trips.filter(t=>['REQUESTED','SCHEDULED','IN_PROGRESS'].includes(String(t.status).toUpperCase())).slice(0,4);
  return <><section className="client-hero"><div><span className="eyebrow">SMARTMOVE CUSTOMER PORTAL</span><h1>Good to see you, {client.name.split(' ')[0]}.</h1><p>Plan your next journey, choose a vehicle and keep your bookings in one place.</p><button className="btn primary" type="button" onClick={()=>go('book')}>Schedule a trip →</button></div><div className="hero-card"><div className="hero-icon">🚐</div><b>{vehicles.length || 0}</b><span>vehicles available</span></div></section>
    <div className="grid g4" style={{margin:'20px 0'}}>{[['Upcoming',n('REQUESTED','SCHEDULED')],['In progress',n('IN_PROGRESS')],['Completed',n('COMPLETED')],['Cancelled',n('CANCELLED')]].map(([l,v])=><section key={l} className="card kpi"><div className="lbl">{l}</div><div className="val">{v}</div></section>)}</div>
    <div className="portal-columns"><section className="card"><div className="section-title"><div><h3>Active & upcoming</h3><p className="meta">Your next journeys</p></div><button className="chip" onClick={()=>go('trips')}>View all</button></div>{next.length?next.map(t=><div key={t.trip_id} className="booking-row"><div><b>{t.journey||`${t.pickup||'-'} → ${t.dropoff||'-'}`}</b><div className="meta">{fmt(t.trip_date)} · {t.vehicle_registration||t.vehicle_type||'Vehicle pending'}</div></div><Tag status={t.status}/></div>):<div className="empty">No active bookings. Schedule your first trip.</div>}</section>
      <section className="card quick-card"><h3>Quick booking</h3><p>Need a ride? Choose your pickup, destination, date, passengers and vehicle.</p><button className="btn dark" onClick={()=>go('book')}>Start booking</button></section></div>
  </>;
}

function Book({ session, vehicles, onBooked }) {
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false); const [distance,setDistance]=useState(25); const [passengers,setPassengers]=useState(1); const [vehicleId,setVehicleId]=useState(''); const [returnTrip,setReturnTrip]=useState(false);
  const min=new Date(Date.now()-new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const defaultDate=new Date(Date.now() + 86400000 - new Date().getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const [selectedFallback]=vehicles;
  useEffect(()=>{if(!vehicleId&&selectedFallback)setVehicleId(selectedFallback.vehicle_id)},[vehicleId,selectedFallback]);
  const current=vehicles.find(v=>String(v.vehicle_id)===String(vehicleId)) || selectedFallback;
  const capacityOk=current ? Number(current.seats||current.seat_capacity||0) >= Number(passengers||1) : false;
  const unavailable=['MAINTENANCE','INACTIVE','UNAVAILABLE','OUT_OF_SERVICE'].includes(String(current?.status||'').toUpperCase());
  const estimated=current ? Number(distance||0)*Number(current.rate||120)*(returnTrip?2:1) : 0;
  async function submit(e){
    e.preventDefault();
    setErr('');
    const f=form(e);
    if(new Date(f.trip_date) < new Date(Date.now() - 60000)) return setErr('Pick a pickup time in the future.');
    if(!current) return setErr('Please select a vehicle.');
    if(!capacityOk) return setErr(`The selected vehicle has ${current.seats} seats, but you entered ${passengers} passenger(s). Please choose a larger vehicle.`);
    if(unavailable) return setErr('The selected vehicle is currently unavailable. Please choose another vehicle.');
    setBusy(true);
    try{
      await bookTrip(session,{
        ...f,
        passengers:Number(f.passengers),
        vehicle_id:current.vehicle_id,
        vehicle_registration:current.registration_no || current.registration || current.reg || current.vehicle_id,
        vehicle_type:current.type,
        estimated_fare:estimated,
        distance_km:Number(distance),
        return_trip:returnTrip
      });
      onBooked();
    }catch(x){
      setErr(x.message || 'Failed to schedule trip');
      setBusy(false);
    }
  }
  return <><div className="head"><div><span className="eyebrow">NEW BOOKING</span><h1>Schedule your trip</h1><p className="sub">Choose your route, date, passengers and your preferred vehicle.</p></div></div>
    <div className="booking-layout"><form className="card booking-form" onSubmit={submit}><h3>1. Journey details</h3><div className="two"><label>Pickup location<input name="pickup" placeholder="e.g. Colombo Fort" required/></label><label>Drop-off location<input name="dropoff" placeholder="e.g. Kandy" required/></label><label>Pickup date & time<input name="trip_date" type="datetime-local" min={min} defaultValue={defaultDate} required/></label><label>Passengers<input name="passengers" type="number" min="1" max="60" value={passengers} onChange={e=>setPassengers(e.target.value)} required/></label><label>Estimated distance (km)<input name="distance_display" type="number" min="1" value={distance} onChange={e=>setDistance(e.target.value)} required/></label><label>Trip type<select name="trip_type"><option value="ON_DEMAND">On-demand</option><option value="STAFF_SERVICE">Staff service</option><option value="AIRPORT_TRANSFER">Airport transfer</option><option value="EVENT">Event / group travel</option></select></label></div>
      <label className="check"><input type="checkbox" checked={returnTrip} onChange={e=>setReturnTrip(e.target.checked)}/> I need a return journey</label>{returnTrip&&<label>Return date & time<input name="return_date" type="datetime-local" min={min}/></label>}
      <label>Special requirements / notes<textarea name="notes" rows="3" placeholder="Child seats, luggage, accessibility needs, stops, etc."/></label><Msg>{err}</Msg><button className="btn primary" type="submit" disabled={busy||!current}>{busy?'Sending request...':'Confirm trip request'}</button></form>
      <aside className="booking-side"><section className="card"><div className="section-title"><div><h3>2. Choose your vehicle</h3><p className="meta">All SmartMove vehicles are shown. You choose your preferred vehicle.</p></div><span className="tag blue">{vehicles.length} vehicles</span></div><div className="vehicle-list">{vehicles.map(v=>{const seats=Number(v.seats||v.seat_capacity||0);const fits=seats>=Number(passengers||1);const unavailableStatus=['MAINTENANCE','INACTIVE','UNAVAILABLE','OUT_OF_SERVICE'].includes(String(v.status||'').toUpperCase());const chosen=String(vehicleId)===String(v.vehicle_id);return <button type="button" key={v.vehicle_id} className={`vehicle-choice ${chosen?'selected':''} ${(!fits||unavailableStatus)?'vehicle-unfit':''}`} onClick={()=>setVehicleId(v.vehicle_id)}><div className="vehicle-art">{v.type==='BUS'?'🚌':'🚐'}</div><div className="grow"><b>{v.registration_no||v.vehicle_id}</b><div className="meta">{v.type==='BUS'?'Bus':'Van'} · {seats} seats</div><div className="meta">{(v.features||[]).slice(0,2).join(' · ')}</div><div className="vehicle-status">{unavailableStatus?'Currently unavailable':!fits?`Capacity: ${seats} seats`:'Available for your group'}</div></div><div className="vehicle-rate"><b>{money(v.rate)}</b><span>/ km</span></div></button>})}</div></section>
        <section className="fare-card"><span className="eyebrow">ESTIMATE</span><div className="fare">{money(estimated)}</div><div className="meta">Approx. {distance || 0} km × {current?money(current.rate):'Rs. 0'}/km</div><small>Final fare may change after route confirmation and actual distance.</small></section></aside>
    </div>
  </>;
}

function downloadTripsReport(tripsList, activeFilter = '') {
  if (!tripsList || !tripsList.length) {
    alert('No bookings available to download.');
    return;
  }
  const headers = ['Booking ID', 'Journey', 'Date & Time', 'Status', 'Vehicle', 'Driver', 'Passengers', 'Estimated Fare'];
  const rows = tripsList.map((t) => [
    t.trip_id || '',
    t.journey || `${t.pickup || ''} → ${t.dropoff || ''}`,
    t.trip_date ? new Date(t.trip_date).toLocaleString() : '',
    t.status || '',
    t.vehicle_registration || t.vehicle_type || 'Pending',
    t.driver_name || 'Pending',
    t.passengers || '',
    t.estimated_fare || ''
  ]);

  const csvContent = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filterSuffix = activeFilter ? `_${activeFilter.toLowerCase()}` : '';
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `smartmove_my_bookings${filterSuffix}_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function MyTrips({ session, trips, onChanged, onBook }) {
  const [q,setQ]=useState('');const [status,setStatus]=useState('');const [sel,setSel]=useState(null);const [err,setErr]=useState('');const [busy,setBusy]=useState(false);
  const list=useMemo(()=>trips.filter(t=>(!status||String(t.status).toUpperCase()===status)&&`${t.trip_id} ${t.journey||''} ${t.driver_name||''} ${t.vehicle_registration||''}`.toLowerCase().includes(q.toLowerCase())),[trips,q,status]);
  async function cancel(t){if(!window.confirm('Cancel this trip request?'))return;setBusy(true);setErr('');try{await cancelTrip(session,t);setSel(null);onChanged()}catch(e){setErr(e.message)}finally{setBusy(false)}}
  return <><div className="head"><div><span className="eyebrow">YOUR JOURNEYS</span><h1>My bookings</h1><p className="sub">Track, review and manage your SmartMove trips.</p></div><button className="btn primary" onClick={onBook}>Schedule another trip</button></div>
    <div className="tools">
      <input className="search" placeholder="Search trip ID, route, driver or vehicle" value={q} onChange={e=>setQ(e.target.value)}/>
      {STATUSES.map(v=><button key={v||'all'} className="chip" aria-pressed={status===v} onClick={()=>setStatus(v)}>{v?v.replaceAll('_',' '):'All'}</button>)}
      <button
        className="btn"
        type="button"
        style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        onClick={() => downloadTripsReport(list, status)}
        disabled={!list.length}
        title="Download my bookings report as CSV"
      >
        📥 Download report
      </button>
    </div>
    <Msg>{err}</Msg>{sel&&<section className="card booking-detail"><div className="section-title"><div><span className="eyebrow">BOOKING {sel.trip_id}</span><h2>{sel.journey||`${sel.pickup} → ${sel.dropoff}`}</h2></div><Tag status={sel.status}/></div><div className="detail-grid"><div><span>Pickup</span><b>{fmt(sel.trip_date)}</b></div><div><span>Vehicle</span><b>{sel.vehicle_registration||'To be assigned'}</b></div><div><span>Driver</span><b>{sel.driver_name||'To be assigned'}</b></div><div><span>Passengers</span><b>{sel.passengers||'-'}</b></div><div><span>Estimated fare</span><b>{sel.estimated_fare?money(sel.estimated_fare):'Pending'}</b></div></div>{['REQUESTED','SCHEDULED'].includes(String(sel.status).toUpperCase())&&<button className="btn danger" disabled={busy} onClick={()=>cancel(sel)}>{busy?'Cancelling...':'Cancel booking'}</button>}<button className="btn" style={{marginLeft:8}} onClick={()=>setSel(null)}>Close</button></section>}
    <section className="card tbl">{!list.length?<div className="empty">No bookings match your search.</div>:<table><thead><tr><th>Trip</th><th>Journey</th><th>Pickup</th><th>Vehicle</th><th>Status</th><th></th></tr></thead><tbody>{list.map(t=><tr key={t.trip_id}><td><b>{t.trip_id}</b></td><td>{t.journey||`${t.pickup||'-'} → ${t.dropoff||'-'}`}</td><td>{fmt(t.trip_date)}</td><td>{t.vehicle_registration||t.vehicle_type||'Pending'}</td><td><Tag status={t.status}/></td><td><button className="chip" onClick={()=>setSel(t)}>View</button></td></tr>)}</tbody></table>}</section></>;
}

function Profile({ session, setSession }) {
  const {client}=session;const[msg,setMsg]=useState('');const[err,setErr]=useState('');const[busy,setBusy]=useState(false);
  async function submit(e){e.preventDefault();setErr('');setMsg('');setBusy(true);try{setSession({...session,client:await saveProfile(session,form(e))});setMsg('Profile updated successfully.')}catch(x){setErr(x.message)}finally{setBusy(false)}}
  return <><div className="head"><div><span className="eyebrow">ACCOUNT</span><h1>My profile</h1><p className="sub">Keep your contact and billing details up to date.</p></div></div><form className="card profile-card" onSubmit={submit}><div className="profile-avatar">{client.name.split(' ').map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div><div className="two"><label>Full name<input name="name" defaultValue={client.name} required/></label><label>Email<input value={client.email} disabled/></label><label>Phone<input name="phone" type="tel" defaultValue={client.phone||''} required/></label>{client.client_type==='CORPORATE'&&<label>Company name<input name="company" defaultValue={client.company||''} required/></label>}<label>Billing / office address<input name="address" defaultValue={client.address||''}/></label></div><Msg>{err}</Msg>{msg&&<div className="note">{msg}</div>}<button className="btn primary" disabled={busy}>{busy?'Saving...':'Save profile'}</button></form></>;
}
