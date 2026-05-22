/* ============================================================
   API utility — all calls to the backend go through here
============================================================ */

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? `http://localhost:${window.location.port || 5000}`
  : '';   // same origin on Vercel

/* ── Auth helpers ── */
const Auth = {
  getToken: ()   => localStorage.getItem('token'),
  getUser:  ()   => JSON.parse(localStorage.getItem('user') || 'null'),
  isLoggedIn: () => !!localStorage.getItem('token'),
  isAdmin:    () => Auth.getUser()?.role === 'admin',
  save: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

/* ── Core fetch wrapper ── */
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

/* ── Auth ── */
const api = {
  auth: {
    register: (body) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(body) }),
    login:    (body) => apiFetch('/api/auth/login',    { method: 'POST', body: JSON.stringify(body) }),
  },

  events: {
    getAll:  (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return apiFetch(`/api/events${q ? '?' + q : ''}`);
    },
    getOne:  (id)  => apiFetch(`/api/events/${id}`),
    create:  (body)=> apiFetch('/api/events', { method: 'POST', body: JSON.stringify(body) }),
    update:  (id, body) => apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete:  (id)  => apiFetch(`/api/events/${id}`, { method: 'DELETE' }),
    attendees: (id)=> apiFetch(`/api/events/${id}/attendees`),
  },

  registrations: {
    register: (event_id) => apiFetch('/api/registrations', { method: 'POST', body: JSON.stringify({ event_id }) }),
    my:       ()         => apiFetch('/api/registrations/my'),
    cancel:   (id)       => apiFetch(`/api/registrations/${id}/cancel`, { method: 'PATCH' }),
  },

  attendance: {
    checkin: (registration_id) => apiFetch('/api/attendance/checkin', { method: 'POST', body: JSON.stringify({ registration_id }) }),
  },

  users: {
    getAll:  ()     => apiFetch('/api/users'),
    me:      ()     => apiFetch('/api/users/me'),
    update:  (body) => apiFetch('/api/users/me', { method: 'PUT', body: JSON.stringify(body) }),
    delete:  (id)   => apiFetch(`/api/users/${id}`, { method: 'DELETE' }),
  },

  clubs: {
    getAll:  ()         => apiFetch('/api/clubs'),
    create:  (body)     => apiFetch('/api/clubs', { method: 'POST', body: JSON.stringify(body) }),
    update:  (id, body) => apiFetch(`/api/clubs/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
    delete:  (id)       => apiFetch(`/api/clubs/${id}`, { method: 'DELETE' }),
  },

  categories: {
    getAll:  ()     => apiFetch('/api/categories'),
    create:  (body) => apiFetch('/api/categories', { method: 'POST', body: JSON.stringify(body) }),
    delete:  (id)   => apiFetch(`/api/categories/${id}`, { method: 'DELETE' }),
  },

  admin: {
    stats: () => apiFetch('/api/admin/stats'),
  },
};
