import { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5001/api';

// =====================================================================
// UTILITIES
// =====================================================================

async function apiCall(method, path, body = null) {
  try {
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body) options.body = JSON.stringify(body);
    
    const response = await fetch(`${API_BASE}${path}`, options);
    const data = await response.json();
    
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    throw new Error(err.message);
  }
}

function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatCurrency(amount) {
  return `Rs. ${Math.round(amount || 0).toLocaleString('en-LK')}`;
}

function StatusBadge({ status }) {
  const colors = {
    REQUESTED: 'bg-yellow-100 text-yellow-800',
    CONFIRMED: 'bg-blue-100 text-blue-800',
    ASSIGNED: 'bg-purple-100 text-purple-800',
    IN_PROGRESS: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>
      {status || 'PENDING'}
    </span>
  );
}

// =====================================================================
// MAIN CUSTOMER PORTAL COMPONENT
// =====================================================================

export default function CustomerPortal() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('auth'); // auth, overview, book, bookings, profile
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Try to restore session from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sm_session');
      if (saved) setSession(JSON.parse(saved));
    } catch (e) {
      // Ignore
    }
  }, []);

  const logout = () => {
    setSession(null);
    localStorage.removeItem('sm_session');
    setView('auth');
    setError('');
  };

  if (!session) {
    return <AuthView onLogin={(session) => {
      setSession(session);
      localStorage.setItem('sm_session', JSON.stringify(session));
      setView('overview');
    }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SmartMove</h1>
            <p className="text-sm text-gray-600">Customer Portal</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="font-semibold text-gray-900">{session.customer.name}</p>
              <p className="text-xs text-gray-500">{session.customer.email}</p>
            </div>
            <button
              onClick={logout}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-6 flex gap-8">
            {[
              { id: 'overview', label: 'Dashboard' },
              { id: 'book', label: 'Book a Trip' },
              { id: 'bookings', label: 'My Bookings' },
              { id: 'profile', label: 'Profile' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`py-4 px-2 border-b-2 transition font-semibold text-sm ${
                  view === id
                    ? 'text-yellow-600 border-yellow-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-800 px-6 py-4 rounded-lg mb-6">
            {error}
            <button
              onClick={() => setError('')}
              className="ml-auto block text-red-800 font-semibold text-sm mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading...</p>
          </div>
        )}

        {!loading && view === 'overview' && (
          <DashboardView session={session} onBook={() => setView('book')} />
        )}
        {!loading && view === 'book' && (
          <BookingView session={session} onBooked={() => {
            setView('bookings');
            setError('✅ Booking created! Check your bookings to manage it.');
          }} setError={setError} />
        )}
        {!loading && view === 'bookings' && (
          <BookingsView session={session} onCancel={() => setError('✅ Booking cancelled successfully')} setError={setError} />
        )}
        {!loading && view === 'profile' && (
          <ProfileView session={session} setSession={setSession} onError={setError} />
        )}
      </main>
    </div>
  );
}

// =====================================================================
// AUTH VIEW - SIGNUP / LOGIN
// =====================================================================

function AuthView({ onLogin }) {
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = Object.fromEntries(form);

    setLoading(true);
    setError('');

    try {
      let result;
      if (isLogin) {
        result = await apiCall('POST', '/customers/login', {
          email: data.email,
          password: data.password,
        });
      } else {
        result = await apiCall('POST', '/customers/register', {
          full_name: data.full_name,
          email: data.email,
          phone: data.phone,
          password: data.password,
          customer_type: data.customer_type || 'INDIVIDUAL',
        });
        // Auto-login after signup
        result = await apiCall('POST', '/customers/login', {
          email: data.email,
          password: data.password,
        });
      }

      onLogin(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">SmartMove</h1>
          <p className="text-gray-600">{isLogin ? 'Welcome back!' : 'Join us today'}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <input
                type="text"
                name="full_name"
                placeholder="Full Name"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <select
                name="customer_type"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="INDIVIDUAL">Individual</option>
                <option value="CORPORATE">Corporate</option>
              </select>
            </>
          )}

          <input
            type="email"
            name="email"
            placeholder="Email"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />

          {!isLogin && (
            <input
              type="tel"
              name="phone"
              placeholder="Phone Number"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />
          )}

          <input
            type="password"
            name="password"
            placeholder="Password"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-sm mt-6">
          {isLogin ? "Don't have an account? " : 'Already have an account? '}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
            }}
            className="text-yellow-600 font-semibold hover:underline"
          >
            {isLogin ? 'Sign up' : 'Login'}
          </button>
        </p>
      </div>
    </div>
  );
}

// =====================================================================
// DASHBOARD VIEW
// =====================================================================

function DashboardView({ session, onBook }) {
  const [bookings, setBookings] = useState([]);
  const [vehicles, setVehicles] = useState([
    { vehicle_id: '1', registration_no: 'SM-VAN-01', type: 'VAN', seats: 12, rate: 120 },
    { vehicle_id: '2', registration_no: 'SM-BUS-01', type: 'BUS', seats: 40, rate: 65 },
  ]);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall('GET', `/bookings/customer/${session.customer.customer_id}`);
        setBookings(result.data?.bookings || []);
      } catch (e) {
        // Use mock data if API fails
      }
    }
    load();
  }, [session]);

  const stats = {
    upcoming: bookings.filter(b => ['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS'].includes(b.status)).length,
    completed: bookings.filter(b => b.status === 'COMPLETED').length,
    cancelled: bookings.filter(b => b.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Welcome, {session.customer.name.split(' ')[0]}!</h2>
        <p className="text-gray-600 mt-2">Manage your trips, book vehicles, and track your journeys</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Upcoming Trips', value: stats.upcoming, color: 'bg-blue-100 text-blue-800' },
          { label: 'Completed', value: stats.completed, color: 'bg-green-100 text-green-800' },
          { label: 'Cancelled', value: stats.cancelled, color: 'bg-red-100 text-red-800' },
        ].map((stat) => (
          <div key={stat.label} className={`${stat.color} rounded-lg p-6 text-center`}>
            <p className="text-sm font-medium opacity-75 mb-2">{stat.label}</p>
            <p className="text-4xl font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <button
        onClick={onBook}
        className="w-full py-4 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold rounded-lg hover:shadow-lg transition text-lg"
      >
        📅 Schedule Your Next Trip
      </button>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">Recent Bookings</h3>
        {bookings.length === 0 ? (
          <p className="text-gray-600 text-center py-8">No bookings yet. Schedule your first trip!</p>
        ) : (
          <div className="space-y-4">
            {bookings.slice(0, 5).map((booking) => (
              <div key={booking.booking_id} className="flex justify-between items-center p-4 border border-gray-200 rounded-lg hover:border-yellow-400 transition">
                <div>
                  <p className="font-semibold text-gray-900">{booking.pickup_location} → {booking.dropoff_location}</p>
                  <p className="text-sm text-gray-600">{formatDate(booking.pickup_datetime)}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// BOOKING VIEW - CREATE NEW BOOKING
// =====================================================================

function BookingView({ session, onBooked, setError }) {
  const [formData, setFormData] = useState({
    pickup_location: '',
    dropoff_location: '',
    pickup_datetime: '',
    passenger_count: 1,
    distance_km: 25,
    trip_type: 'ON_DEMAND',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await apiCall('POST', '/bookings', {
        ...formData,
        customer_id: session.customer.customer_id,
        passenger_count: parseInt(formData.passenger_count),
        distance_km: parseInt(formData.distance_km),
      });
      onBooked();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const estimated = formData.distance_km * 120;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Book a Trip</h2>
        <p className="text-gray-600 mt-2">Schedule your journey with SmartMove</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Booking Form */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Pickup Location"
                value={formData.pickup_location}
                onChange={(e) => setFormData({ ...formData, pickup_location: e.target.value })}
                required
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="text"
                placeholder="Drop-off Location"
                value={formData.dropoff_location}
                onChange={(e) => setFormData({ ...formData, dropoff_location: e.target.value })}
                required
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            <input
              type="datetime-local"
              value={formData.pickup_datetime}
              onChange={(e) => setFormData({ ...formData, pickup_datetime: e.target.value })}
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="number"
                min="1"
                max="60"
                placeholder="Passengers"
                value={formData.passenger_count}
                onChange={(e) => setFormData({ ...formData, passenger_count: e.target.value })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <input
                type="number"
                min="1"
                placeholder="Distance (km)"
                value={formData.distance_km}
                onChange={(e) => setFormData({ ...formData, distance_km: e.target.value })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
              <select
                value={formData.trip_type}
                onChange={(e) => setFormData({ ...formData, trip_type: e.target.value })}
                className="px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              >
                <option value="ON_DEMAND">On-Demand</option>
                <option value="AIRPORT_TRANSFER">Airport Transfer</option>
                <option value="EVENT">Event</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50"
            >
              {loading ? 'Creating Booking...' : 'Confirm Booking'}
            </button>
          </div>
        </form>

        {/* Fare Estimate */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 h-fit">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Fare Estimate</h3>
          <div className="space-y-4 pb-6 border-b border-gray-200">
            <div className="flex justify-between">
              <span className="text-gray-600">Distance</span>
              <span className="font-semibold">{formData.distance_km} km</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Rate</span>
              <span className="font-semibold">Rs. 120/km</span>
            </div>
          </div>
          <div className="flex justify-between items-center pt-6">
            <span className="text-gray-700 font-semibold">Estimated Total</span>
            <span className="text-3xl font-bold text-yellow-600">{formatCurrency(estimated)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-4">Final fare may vary based on actual distance</p>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// BOOKINGS VIEW - MY BOOKINGS
// =====================================================================

function BookingsView({ session, onCancel, setError }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall('GET', `/bookings/customer/${session.customer.customer_id}`);
        setBookings(result.data?.bookings || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [session, setError]);

  async function handleCancel(bookingId) {
    if (!window.confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await apiCall('PUT', `/bookings/${bookingId}/cancel`, {
        reason: 'Cancelled by customer',
      });
      setBookings(bookings.map(b => b.booking_id === bookingId ? { ...b, status: 'CANCELLED' } : b));
      onCancel();
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading) return <p>Loading your bookings...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">My Bookings</h2>
        <p className="text-gray-600 mt-2">Track and manage all your trips</p>
      </div>

      {bookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No bookings found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <div key={booking.booking_id} className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{booking.booking_id}</h3>
                  <p className="text-gray-600">{booking.pickup_location} → {booking.dropoff_location}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4 border-t border-b border-gray-200">
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="font-semibold">{formatDate(booking.pickup_datetime)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Passengers</p>
                  <p className="font-semibold">{booking.passenger_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Distance</p>
                  <p className="font-semibold">{booking.distance_km} km</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Fare</p>
                  <p className="font-semibold">{formatCurrency(booking.estimated_fare)}</p>
                </div>
              </div>

              {['REQUESTED', 'CONFIRMED'].includes(booking.status) && (
                <button
                  onClick={() => handleCancel(booking.booking_id)}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold text-sm"
                >
                  Cancel Booking
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// PROFILE VIEW
// =====================================================================

function ProfileView({ session, setSession, onError }) {
  const [formData, setFormData] = useState({
    full_name: session.customer.name,
    phone: session.customer.phone || '',
    address: session.customer.address || '',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await apiCall('PUT', `/customers/${session.customer.customer_id}`, {
        full_name: formData.full_name,
        phone: formData.phone,
        address: formData.address,
      });
      
      setSession({
        ...session,
        customer: {
          ...session.customer,
          name: result.data.customer.name,
          phone: result.data.customer.phone,
          address: result.data.customer.address,
        },
      });
      localStorage.setItem('sm_session', JSON.stringify({
        ...session,
        customer: result.data.customer,
      }));
      onError('✅ Profile updated successfully');
    } catch (err) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">My Profile</h2>
        <p className="text-gray-600 mt-2">Update your account information</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-lg border border-gray-200 p-8 max-w-2xl space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
          <input
            type="email"
            value={session.customer.email}
            disabled
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={formData.full_name}
            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Phone</label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Address</label>
          <input
            type="text"
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold rounded-lg hover:shadow-lg transition disabled:opacity-50"
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
