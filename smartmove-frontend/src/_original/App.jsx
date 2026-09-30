import { useCallback, useEffect, useRef, useState } from 'react';

const NAV_ITEMS = [
  ['overview', 'Overview'],
  ['trips', 'Trips'],
  ['reviews', 'Reviews'],
  ['top', 'Top rated'],
  ['complaints', 'Complaints'],
  ['lookup', 'Route & driver lookup'],
];
const TRIP_STATUSES = ['', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const COMPLAINT_TYPES = ['BEHAVIOR', 'CONDITION', 'TIMING', 'SAFETY', 'OTHER'];

function readSavedBase() {
  try {
    return localStorage.getItem('sm_base') || 'http://localhost:5001';
  } catch {
    return 'http://localhost:5001';
  }
}

function formatDate(date) {
  return date
    ? new Date(date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
    : '-';
}

function Stars({ rating }) {
  const value = Math.max(0, Math.min(5, Number(rating) || 0));
  return (
    <span className="stars" aria-label={`${value} out of 5`}>
      {'★'.repeat(value)}{'☆'.repeat(5 - value)}
    </span>
  );
}

function ErrorMessage({ message }) {
  return <div className="msg" role="alert">{message}</div>;
}

function StatusTag({ status }) {
  const color = {
    COMPLETED: 'ok',
    IN_PROGRESS: 'warn',
    SCHEDULED: 'warn',
    CANCELLED: 'bad',
  }[String(status).toUpperCase()] || '';
  return <span className={`tag ${color}`}>{status}</span>;
}

function ReviewCard({ review }) {
  return (
    <article className="review">
      <Stars rating={review.rating} />
      <h3>{review.review_title || 'No title'}</h3>
      <div>{review.review_text}</div>
      <div className="meta">
        {formatDate(review.review_date)} · Trip {review.trip_id}
        {review.is_complaint && (
          <> · <span className="bad">Complaint: {review.complaint_type}</span></>
        )}
      </div>
    </article>
  );
}

function SectionHeading({ title, children }) {
  return (
    <>
      <h1>{title}</h1>
      <p className="sub">{children}</p>
    </>
  );
}

function Modal({ children, onClose }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      {children}
    </dialog>
  );
}

function App() {
  const [activeView, setActiveView] = useState('overview');
  const [apiBase, setApiBase] = useState(readSavedBase);
  const [apiAddress, setApiAddress] = useState(readSavedBase);
  const [tripStatus, setTripStatus] = useState('');
  const [tripOffset, setTripOffset] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [dialog, setDialog] = useState(null);

  const api = useCallback(async (path, options) => {
    let response;
    try {
      response = await fetch(`${apiBase}${path}`, options);
    } catch {
      throw new Error(
        `Cannot reach the API at ${apiBase}. Start the backend with "npm run dev" and check the address.`,
      );
    }

    const body = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 503) {
      throw new Error(body.error || body.message || `Request failed (${response.status})`);
    }
    return body;
  }, [apiBase]);

  function saveApiAddress(event) {
    event.preventDefault();
    const value = apiAddress.trim().replace(/\/+$/, '');
    if (!value) return;
    setApiAddress(value);
    setApiBase(value);
    try {
      localStorage.setItem('sm_base', value);
    } catch {
      // The address still works for this session when storage is unavailable.
    }
  }

  function navigate(view) {
    setActiveView(view);
  }

  return (
    <div className="layout">
      <nav className="sidebar" aria-label="Main navigation">
        <div className="brand"><span>SM</span>SmartMove</div>
        {NAV_ITEMS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={activeView === id ? 'page' : undefined}
            onClick={() => navigate(id)}
          >
            {label}
          </button>
        ))}
        <form className="api-config" onSubmit={saveApiAddress}>
          <label htmlFor="api-address">API address</label>
          <input
            id="api-address"
            value={apiAddress}
            onChange={(event) => setApiAddress(event.target.value)}
            onBlur={saveApiAddress}
          />
        </form>
      </nav>

      <main className="content">
        {activeView === 'overview' && <Overview api={api} />}
        {activeView === 'trips' && (
          <Trips
            api={api}
            status={tripStatus}
            setStatus={(status) => {
              setTripStatus(status);
              setTripOffset(0);
            }}
            offset={tripOffset}
            setOffset={setTripOffset}
            onSelectTrip={(id) => setDialog({ type: 'trip', id })}
          />
        )}
        {activeView === 'reviews' && (
          <Reviews
            api={api}
            page={reviewPage}
            setPage={setReviewPage}
            onWriteReview={() => setDialog({ type: 'review', tripId: '' })}
          />
        )}
        {activeView === 'top' && <TopRated api={api} />}
        {activeView === 'complaints' && <Complaints api={api} />}
        {activeView === 'lookup' && <Lookup api={api} />}
      </main>

      {dialog?.type === 'trip' && (
        <TripDialog
          key={`trip-${dialog.id}`}
          api={api}
          tripId={dialog.id}
          onClose={() => setDialog(null)}
          onReview={(tripId) => setDialog({ type: 'review', tripId })}
        />
      )}
      {dialog?.type === 'review' && (
        <ReviewDialog
          key={`review-${dialog.tripId}`}
          api={api}
          tripId={dialog.tripId}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function Overview({ api }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api('/api/health')
      .then((result) => {
        if (current) setHealth(result);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => { current = false; };
  }, [api]);

  return (
    <>
      <SectionHeading title="Overview">Is the backend and are both databases up?</SectionHeading>
      {error ? <ErrorMessage message={error} /> : (
        <section className="panel" aria-live="polite">
          {!health ? 'Checking...' : (
            <>
              <div className="stat">
                <div>
                  <b className={health.status === 'healthy' ? 'ok' : 'bad'}>{health.status}</b>
                  Backend
                </div>
                <DatabaseStatus name="Oracle (trips, drivers, routes)" database={health.databases.oracle} />
                <DatabaseStatus name="MongoDB (reviews)" database={health.databases.mongodb} />
                <div><b>{Math.round(health.uptime)}s</b>Uptime</div>
              </div>
              <p className="meta">
                Checked {formatDate(health.timestamp)} · {health.environment}
              </p>
            </>
          )}
        </section>
      )}
    </>
  );
}

function DatabaseStatus({ name, database }) {
  return (
    <div>
      <b className={database.status === 'connected' ? 'ok' : 'bad'}>{database.status}</b>
      {name}
      {database.error && <div className="meta">{database.error}</div>}
    </div>
  );
}

function Trips({ api, status, setStatus, offset, setOffset, onSelectTrip }) {
  const [trips, setTrips] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const limit = 10;

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    const path = status
      ? `/api/trips/status/${status}`
      : `/api/trips?limit=${limit}&offset=${offset}`;
    api(path)
      .then((result) => {
        if (current) setTrips(result.data.trips);
      })
      .catch((err) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [api, status, offset]);

  return (
    <>
      <SectionHeading title="Trips">Staff service and on-demand trips from Oracle.</SectionHeading>
      <div className="bar">
        {TRIP_STATUSES.map((value) => (
          <button
            className="chip"
            type="button"
            aria-pressed={status === value}
            key={value || 'all'}
            onClick={() => setStatus(value)}
          >
            {value ? value.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>
      {error ? <ErrorMessage message={error} /> : (
        <section className="panel tbl" aria-live="polite">
          {loading ? 'Loading...' : trips.length === 0 ? (
            <div className="empty">No trips found for this filter.</div>
          ) : (
            <table>
              <thead>
                <tr><th>Trip</th><th>Date</th><th>Status</th><th>Driver</th><th>Vehicle</th></tr>
              </thead>
              <tbody>
                {trips.map((trip) => (
                  <tr
                    className="row"
                    key={trip.trip_id}
                    tabIndex="0"
                    onClick={() => onSelectTrip(trip.trip_id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectTrip(trip.trip_id);
                      }
                    }}
                  >
                    <td>{trip.trip_id}</td>
                    <td>{formatDate(trip.trip_date)}</td>
                    <td><StatusTag status={trip.status} /></td>
                    <td>{trip.driver_name}</td>
                    <td>{trip.vehicle_registration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
      {!status && !error && (
        <div className="bar">
          <button
            className="btn"
            type="button"
            disabled={!offset}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <button
            className="btn"
            type="button"
            disabled={trips.length < limit}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </button>
          <span className="meta">
            {trips.length ? `Showing ${offset + 1}-${offset + trips.length}` : 'No trips'}
          </span>
        </div>
      )}
    </>
  );
}

function TripDialog({ api, tripId, onClose, onReview }) {
  const [trip, setTrip] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api(`/api/trips/${encodeURIComponent(tripId)}`)
      .then((result) => {
        if (current) setTrip(result.data.trip);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => { current = false; };
  }, [api, tripId]);

  return (
    <Modal onClose={onClose}>
      {error ? <ErrorMessage message={error} /> : !trip ? 'Loading...' : (
        <>
          <h2>Trip {trip.trip_id}</h2>
          <StatusTag status={trip.status} />
          <dl>
            <dt>Journey</dt><dd>{trip.journey}</dd>
            <dt>Date</dt><dd>{formatDate(trip.trip_date)}</dd>
            <dt>Type</dt><dd>{trip.trip_type.replace('_', ' ').toLowerCase()}</dd>
            <dt>Driver</dt><dd>{trip.driver_name}</dd>
            <dt>Vehicle</dt>
            <dd>{trip.vehicle_registration} ({trip.seat_capacity} seats)</dd>
          </dl>
          <div className="bar">
            <button className="btn primary" type="button" onClick={() => onReview(trip.trip_id)}>
              Review this trip
            </button>
            <button className="btn" type="button" onClick={onClose}>Close</button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Reviews({ api, page, setPage, onWriteReview }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError('');
    api(`/api/reviews?page=${page}&limit=6`)
      .then((response) => {
        if (current) setResult(response.data);
      })
      .catch((err) => {
        if (current) setError(err.message);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => { current = false; };
  }, [api, page]);

  return (
    <>
      <SectionHeading title="Reviews">Approved passenger reviews from MongoDB.</SectionHeading>
      <div className="bar"><span className="grow" /><button className="btn primary" type="button" onClick={onWriteReview}>Write a review</button></div>
      {error ? <ErrorMessage message={error} /> : (
        <section className="panel" aria-live="polite">
          {loading ? 'Loading...' : result.reviews.length ? (
            result.reviews.map((review) => <ReviewCard key={review._id || `${review.trip_id}-${review.review_date}`} review={review} />)
          ) : <div className="empty">No approved reviews yet. Write the first one.</div>}
        </section>
      )}
      {result && !error && (
        <div className="bar">
          <button className="btn" type="button" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn" type="button" disabled={page >= result.pagination.pages} onClick={() => setPage(page + 1)}>Next</button>
          <span className="meta">
            Page {result.pagination.page} of {result.pagination.pages || 1} · {result.pagination.total} reviews
          </span>
        </div>
      )}
    </>
  );
}

function ReviewDialog({ api, tripId, onClose }) {
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);

  async function submitReview(event) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const body = {
      trip_id: String(form.get('trip_id')).trim(),
      passenger_id: String(form.get('passenger_id')).trim(),
      rating: String(form.get('rating')),
      review_title: String(form.get('review_title')).trim(),
      review_text: String(form.get('review_text')).trim(),
    };
    if (!body.trip_id || !body.passenger_id || !body.review_text) {
      setError('Trip ID, passenger ID and review text are required.');
      return;
    }

    setSending(true);
    try {
      await api('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      {submitted ? (
        <>
          <h2>Review submitted</h2>
          <p>It will appear after moderation.</p>
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </>
      ) : (
        <form onSubmit={submitReview}>
          <h2>Write a review</h2>
          <label>Trip ID<input name="trip_id" defaultValue={tripId} required /></label>
          <label>Passenger ID<input name="passenger_id" required /></label>
          <label>
            Rating
            <select name="rating" defaultValue="5">
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>{rating} - {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}</option>
              ))}
            </select>
          </label>
          <label>Title<input name="review_title" /></label>
          <label>Your review<textarea name="review_text" rows="4" required /></label>
          {error && <ErrorMessage message={error} />}
          <div className="bar modal-actions">
            <button className="btn primary" type="submit" disabled={sending}>
              {sending ? 'Submitting...' : 'Submit review'}
            </button>
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function TopRated({ api }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    api('/api/reviews/highest-rated')
      .then((result) => {
        if (current) setData(result.data);
      })
      .catch((err) => {
        if (current) setError(err.message);
      });
    return () => { current = false; };
  }, [api]);

  return (
    <>
      <SectionHeading title="Top rated">Best drivers and vehicles by average rating.</SectionHeading>
      {error ? <ErrorMessage message={error} /> : !data ? 'Loading...' : (
        <div className="grid2">
          <RatingTable title="Drivers" identifier="Driver" rows={data.top_drivers} nameKey="driver_name" />
          <RatingTable title="Vehicles" identifier="Registration" rows={data.top_vehicles} nameKey="registration_no" />
        </div>
      )}
    </>
  );
}

function RatingTable({ title, identifier, rows, nameKey }) {
  return (
    <section>
      <h2>{title}</h2>
      <div className="panel tbl">
        <table>
          <thead><tr><th>{identifier}</th><th>Average</th><th>Reviews</th></tr></thead>
          <tbody>
            {rows.length ? rows.map((row, index) => (
              <tr key={row[nameKey] || index}>
                <td>{row[nameKey]}</td>
                <td><Stars rating={Math.round(row.avg_rating)} /> <span className="meta">{Number(row.avg_rating).toFixed(2)}</span></td>
                <td>{row.total_reviews}</td>
              </tr>
            )) : <tr><td colSpan="3" className="empty">No data yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Complaints({ api }) {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('');
  const [days, setDays] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function search(event) {
    event.preventDefault();
    setError('');
    const params = new URLSearchParams();
    if (keyword.trim()) params.set('q', keyword.trim());
    if (type) params.set('type', type);
    if (days) params.set('days', days);
    if (!keyword.trim() && !type) {
      setError('Enter a keyword or choose a complaint type.');
      return;
    }
    setLoading(true);
    try {
      const response = await api(`/api/reviews/search?${params}`);
      setResult(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SectionHeading title="Complaints">Search approved complaints by keyword, type or age.</SectionHeading>
      <form className="panel bar search-form" onSubmit={search}>
        <input aria-label="Keyword" placeholder="Keyword" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Any type</option>
          {COMPLAINT_TYPES.map((value) => <option key={value}>{value}</option>)}
        </select>
        <select aria-label="Period" value={days} onChange={(event) => setDays(event.target.value)}>
          <option value="">Any time</option><option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option><option value="90">Last 90 days</option>
        </select>
        <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Searching...' : 'Search'}</button>
      </form>
      {error && <ErrorMessage message={error} />}
      {result && !error && (
        <>
          <p className="meta">{result.total_complaints} complaint(s) found</p>
          {result.complaints.length ? (
            <section className="panel">{result.complaints.map((review, index) => (
              <ReviewCard key={review._id || `${review.trip_id}-${index}`} review={review} />
            ))}</section>
          ) : <div className="empty">No complaints match. Try a broader search.</div>}
        </>
      )}
    </>
  );
}

function Lookup({ api }) {
  const [kind, setKind] = useState('route');
  const [id, setId] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(event) {
    event.preventDefault();
    setError('');
    setData(null);
    if (!id.trim()) {
      setError('Enter an ID first.');
      return;
    }
    setLoading(true);
    try {
      const result = await api(`/api/reviews/${kind}/${encodeURIComponent(id.trim())}`);
      setData(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const stats = data?.statistics;
  const entity = data?.[kind];
  return (
    <>
      <SectionHeading title="Route & driver lookup">See reviews and rating statistics for one route or driver.</SectionHeading>
      <form className="panel bar search-form" onSubmit={lookup}>
        <select aria-label="Lookup type" value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="route">Route</option><option value="driver">Driver</option>
        </select>
        <input aria-label="ID" placeholder="ID, e.g. R001" value={id} onChange={(event) => setId(event.target.value)} />
        <button className="btn primary" type="submit" disabled={loading}>{loading ? 'Looking up...' : 'Look up'}</button>
      </form>
      {error && <ErrorMessage message={error} />}
      {data && entity && stats && (
        <>
          <section className="panel">
            <h2>{entity.name}</h2>
            <p className="meta">
              {kind === 'route'
                ? `${entity.totalDistance} km`
                : `${entity.status} · hired ${formatDate(entity.hireDate)}`}
            </p>
            <div className="stat">
              <div><b>{(stats.avg_rating || 0).toFixed(2)}</b>Average rating</div>
              <div><b>{stats.total_reviews}</b>Reviews</div>
              <div><b>{stats.complaints ?? 0}</b>Complaints</div>
            </div>
          </section>
          <section className="panel">
            {data.reviews.length ? data.reviews.map((review, index) => (
              <ReviewCard key={review._id || `${review.trip_id}-${index}`} review={review} />
            )) : <div className="empty">No approved reviews yet.</div>}
          </section>
        </>
      )}
    </>
  );
}

export default App;
