import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5001/api';

// =====================================================================
// API UTILITIES
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
  if (!amount) return 'Rs. 0';
  return `Rs. ${Math.round(amount).toLocaleString('en-LK')}`;
}

function StatCard({ label, value, color = 'bg-blue-100 text-blue-800' }) {
  return (
    <div className={`${color} rounded-lg p-6`}>
      <p className="text-sm font-medium opacity-75 mb-2">{label}</p>
      <p className="text-4xl font-bold">{value}</p>
    </div>
  );
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
// MAIN ADMIN DASHBOARD
// =====================================================================

export default function AdminDashboard() {
  const [view, setView] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const result = await apiCall('GET', '/admin/stats');
      setStats(result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">SmartMove</h1>
              <p className="text-sm text-gray-600">Admin Dashboard</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Administrator</p>
              <p className="text-xs text-gray-500">{new Date().toLocaleDateString()}</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex gap-8 mt-6 border-t border-gray-200 pt-4">
            {[
              { id: 'dashboard', label: '📊 Dashboard' },
              { id: 'bookings', label: '📅 Bookings' },
              { id: 'customers', label: '👥 Customers' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={`pb-3 border-b-2 transition font-semibold text-sm ${
                  view === id
                    ? 'text-yellow-600 border-yellow-600'
                    : 'text-gray-600 border-transparent hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-800 px-6 py-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && view === 'dashboard' ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        ) : (
          <>
            {view === 'dashboard' && stats && <DashboardView stats={stats} onRefresh={loadStats} />}
            {view === 'bookings' && <BookingsView />}
            {view === 'customers' && <CustomersView />}
          </>
        )}
      </main>
    </div>
  );
}

// =====================================================================
// DASHBOARD VIEW
// =====================================================================

function DashboardView({ stats, onRefresh }) {
  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Dashboard</h2>
          <p className="text-gray-600 mt-2">Real-time fleet and booking overview</p>
        </div>
        <button
          onClick={onRefresh}
          className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Key Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Total Customers" value={stats.customers?.total || 0} color="bg-blue-100 text-blue-800" />
        <StatCard label="Active Customers" value={stats.customers?.active || 0} color="bg-green-100 text-green-800" />
        <StatCard label="Total Bookings" value={stats.bookings?.total || 0} color="bg-purple-100 text-purple-800" />
        <StatCard label="Revenue" value={formatCurrency(stats.bookings?.total_revenue)} color="bg-yellow-100 text-yellow-800" />
      </div>

      {/* Booking Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Pending</p>
          <p className="text-3xl font-bold text-yellow-600">{stats.bookings?.pending || 0}</p>
          <p className="text-xs text-gray-500 mt-2">Awaiting approval</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Confirmed</p>
          <p className="text-3xl font-bold text-blue-600">{stats.bookings?.confirmed || 0}</p>
          <p className="text-xs text-gray-500 mt-2">Ready for assignment</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Active</p>
          <p className="text-3xl font-bold text-green-600">{stats.bookings?.active || 0}</p>
          <p className="text-xs text-gray-500 mt-2">In progress</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-sm text-gray-600 mb-2">Completed</p>
          <p className="text-3xl font-bold text-gray-600">{stats.bookings?.completed || 0}</p>
          <p className="text-xs text-gray-500 mt-2">Successfully delivered</p>
        </div>
      </div>

      {/* Recent Activity Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <PendingBookingsWidget />
        <RecentCustomersWidget />
      </div>
    </div>
  );
}

// =====================================================================
// PENDING BOOKINGS WIDGET
// =====================================================================

function PendingBookingsWidget() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall('GET', '/admin/pending');
        setBookings(result.data?.pending_bookings || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">⏳ Pending Bookings</h3>
      
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : bookings.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No pending bookings</p>
      ) : (
        <div className="space-y-4">
          {bookings.slice(0, 5).map((booking) => (
            <div key={booking.booking_id} className="p-4 border border-gray-200 rounded-lg hover:border-yellow-400 transition">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="font-semibold text-gray-900">{booking.booking_id}</p>
                  <p className="text-sm text-gray-600">{booking.customer_name}</p>
                </div>
                <StatusBadge status={booking.status} />
              </div>
              <p className="text-sm text-gray-600">
                📍 {booking.pickup_location} → {booking.dropoff_location}
              </p>
              <p className="text-sm text-gray-600 mt-1">
                🕐 {formatDate(booking.pickup_datetime)} | 👥 {booking.passenger_count} passengers
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// RECENT CUSTOMERS WIDGET
// =====================================================================

function RecentCustomersWidget() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall('GET', '/admin/recent-customers?limit=5');
        setCustomers(result.data?.recent_customers || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-6">👥 Recent Signups</h3>
      
      {loading ? (
        <p className="text-gray-600">Loading...</p>
      ) : customers.length === 0 ? (
        <p className="text-gray-600 text-center py-8">No recent signups</p>
      ) : (
        <div className="space-y-4">
          {customers.map((customer) => (
            <div key={customer.customer_id} className="p-4 border border-gray-200 rounded-lg hover:border-yellow-400 transition">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                  <p className="text-xs text-gray-500 mt-1">{customer.type} • {formatDate(customer.created_date)}</p>
                </div>
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                  New
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================================================================
// BOOKINGS VIEW
// =====================================================================

function BookingsView() {
  const [bookings, setBookings] = useState([]);
  const [status, setStatus] = useState('REQUESTED');
  const [loading, setLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  useEffect(() => {
    loadBookings();
    loadVehiclesAndDrivers();
  }, [status]);

  async function loadBookings() {
    try {
      const result = await apiCall('GET', `/bookings?status=${status}`);
      setBookings(result.data?.bookings || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function loadVehiclesAndDrivers() {
    try {
      const [vehiclesResult, driversResult] = await Promise.all([
        apiCall('GET', '/admin/vehicles/available'),
        apiCall('GET', '/admin/drivers/available'),
      ]);
      setVehicles(vehiclesResult.data?.vehicles || []);
      setDrivers(driversResult.data?.drivers || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleAssign(bookingId, vehicleId, driverId) {
    try {
      await apiCall('PUT', `/admin/assign/${bookingId}`, {
        vehicle_id: vehicleId,
        driver_id: driverId,
      });
      loadBookings();
      setSelectedBooking(null);
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Booking Management</h2>
        <p className="text-gray-600 mt-2">Review, approve, and assign bookings</p>
      </div>

      {/* Status Filter */}
      <div className="flex gap-3 flex-wrap">
        {['REQUESTED', 'CONFIRMED', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setLoading(true);
            }}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition ${
              status === s
                ? 'bg-yellow-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:border-yellow-400'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      {loading ? (
        <p className="text-gray-600">Loading bookings...</p>
      ) : bookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No bookings with status "{status}"</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Booking</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Customer</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Route</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Pickup</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Vehicle</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Driver</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bookings.map((booking) => (
                <tr key={booking.booking_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">{booking.booking_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.customer_name}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {booking.pickup_location} → {booking.dropoff_location}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{formatDate(booking.pickup_datetime)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.vehicle_registration || '-'}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{booking.driver_name || '-'}</td>
                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setSelectedBooking(booking)}
                      className="text-yellow-600 hover:text-yellow-700 font-semibold"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Assignment Modal */}
      {selectedBooking && (
        <AssignmentModal
          booking={selectedBooking}
          vehicles={vehicles}
          drivers={drivers}
          onAssign={handleAssign}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  );
}

function AssignmentModal({ booking, vehicles, drivers, onAssign, onClose }) {
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!vehicleId || !driverId) {
      alert('Please select both vehicle and driver');
      return;
    }
    setLoading(true);
    try {
      await onAssign(booking.booking_id, vehicleId, driverId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-md w-full">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Assign Vehicle & Driver</h2>

        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Booking</p>
            <p className="text-gray-900 font-semibold">{booking.booking_id}</p>
            <p className="text-sm text-gray-600">{booking.customer_name}</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Vehicle</label>
            <select
              value={vehicleId}
              onChange={(e) => setVehicleId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Select a vehicle...</option>
              {vehicles.map((v) => (
                <option key={v.vehicle_id} value={v.vehicle_id}>
                  {v.registration_no} ({v.type} • {v.seat_capacity} seats)
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Driver</label>
            <select
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            >
              <option value="">Select a driver...</option>
              {drivers.map((d) => (
                <option key={d.driver_id} value={d.driver_id}>
                  {d.name} ({d.license_number})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={handleSubmit}
            disabled={loading || !vehicleId || !driverId}
            className="flex-1 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition font-semibold disabled:opacity-50"
          >
            {loading ? 'Assigning...' : 'Assign'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// CUSTOMERS VIEW
// =====================================================================

function CustomersView() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await apiCall('GET', '/passengers');
        setCustomers(result.data?.passengers || []);
      } catch (err) {
        console.error('Error loading passengers:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-gray-900">Customer Management</h2>
        <p className="text-gray-600 mt-2">
          View all registered passengers
        </p>
      </div>

      {loading ? (
        <p className="text-gray-600">Loading customers...</p>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-600">No customers found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  ID
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Name
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Email
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Phone
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Type
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Registered
                </th>
                <th className="text-left px-6 py-3 font-semibold text-gray-900 text-sm">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {customers.map((customer) => (
                <tr
                  key={customer.passenger_id}
                  className="hover:bg-gray-50"
                >
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {customer.passenger_id}
                  </td>

                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {customer.name}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.email || '-'}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.phone || '-'}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {customer.passenger_type || '-'}
                  </td>

                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(customer.registered_date)}
                  </td>

                  <td className="px-6 py-4 text-sm">
                    <button
                      onClick={() => setSelectedCustomer(customer)}
                      className="text-yellow-600 hover:text-yellow-700 font-semibold"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Passenger Details Modal */}
      {selectedCustomer && (
        <PassengerDetailsModal
          passenger={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function PassengerDetailsModal({ passenger, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-8 max-w-lg w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            Passenger Details
          </h2>

          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-sm text-gray-600">Passenger ID</p>
            <p className="font-semibold text-gray-900">
              {passenger.passenger_id}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-semibold text-gray-900">
              {passenger.name}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Email</p>
            <p className="font-semibold text-gray-900">
              {passenger.email || '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Phone</p>
            <p className="font-semibold text-gray-900">
              {passenger.phone || '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Passenger Type</p>
            <p className="font-semibold text-gray-900">
              {passenger.passenger_type || '-'}
            </p>
          </div>

          <div>
            <p className="text-sm text-gray-600">Registered Date</p>
            <p className="font-semibold text-gray-900">
              {formatDate(passenger.registered_date)}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full mt-8 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition font-semibold"
        >
          Close
        </button>
      </div>
    </div>
  );
}