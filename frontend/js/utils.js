/* ============================================================
   Shared UI utilities
============================================================ */

/* ── Toast notifications ── */
function showToast(message, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = document.getElementById('toast-container')
    || (() => {
      const el = document.createElement('div');
      el.id = 'toast-container';
      document.body.appendChild(el);
      return el;
    })();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => toast.remove());
  }, 3500);
}

/* ── Page loader ── */
function showLoader() {
  let loader = document.getElementById('page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.className = 'page-loader';
    loader.innerHTML = `
      <div class="logo-pulse">🎓</div>
      <div class="spinner"></div>
    `;
    document.body.appendChild(loader);
  }
  loader.style.display = 'flex';
}
function hideLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) loader.style.display = 'none';
}

/* ── Date formatting ── */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
function timeUntil(dateStr) {
  const diff = new Date(dateStr) - new Date();
  if (diff < 0) return 'Past';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d away`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs > 0) return `${hrs}h away`;
  return 'Soon';
}

/* ── Truncate text ── */
function truncate(str, n = 100) {
  return str && str.length > n ? str.slice(0, n) + '…' : str;
}

/* ── Redirect helpers ── */
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = '/frontend/pages/login.html';
    return false;
  }
  return true;
}
function requireAdmin() {
  if (!Auth.isLoggedIn() || !Auth.isAdmin()) {
    window.location.href = '/frontend/pages/login.html';
    return false;
  }
  return true;
}

/* ── Navbar active link ── */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.navbar-links a, .mobile-nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') && path.endsWith(a.getAttribute('href').replace('../', '').replace('./', '')));
  });
}

/* ── Render navbar auth state ── */
function renderNavAuth() {
  const user = Auth.getUser();
  const actionsEl = document.getElementById('nav-actions');
  const mobileActionsEl = document.getElementById('mobile-nav-actions');

  if (!actionsEl) return;

  if (user) {
    actionsEl.innerHTML = `
      <span style="font-size:13px;color:var(--text-secondary);padding:0 8px">
        Hi, ${user.full_name.split(' ')[0]}
      </span>
      ${user.role === 'admin'
        ? `<a href="/frontend/pages/admin.html" class="btn btn-outline btn-sm">Dashboard</a>`
        : `<a href="/frontend/pages/dashboard.html" class="btn btn-ghost btn-sm">My Events</a>`}
      <button onclick="logout()" class="btn btn-ghost btn-sm">Sign out</button>
    `;
    if (mobileActionsEl) mobileActionsEl.innerHTML = actionsEl.innerHTML;
  } else {
    actionsEl.innerHTML = `
      <a href="/frontend/pages/login.html" class="btn btn-ghost btn-sm">Sign in</a>
      <a href="/frontend/pages/register.html" class="btn btn-primary btn-sm">Sign up</a>
    `;
    if (mobileActionsEl) mobileActionsEl.innerHTML = actionsEl.innerHTML;
  }
}

function logout() {
  Auth.clear();
  showToast('Signed out successfully', 'info');
  setTimeout(() => window.location.href = '/frontend/index.html', 800);
}

/* ── Hamburger toggle ── */
function initHamburger() {
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobile-nav');
  if (!btn || !nav) return;
  btn.addEventListener('click', () => nav.classList.toggle('open'));
}

/* ── Modal helpers ── */
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

/* ── Event card HTML ── */
function eventCardHTML(ev) {
  const emoji = ['🎓','🚀','💡','🎤','🏆','🌟','💻','🎯'][ev.id % 8];
  return `
    <div class="event-card animate-in" onclick="window.location.href='/frontend/pages/event.html?id=${ev.id}'">
      <div class="event-card-image">${ev.image
        ? `<img src="${ev.image}" alt="${ev.title}" style="width:100%;height:100%;object-fit:cover">`
        : emoji}
      </div>
      <div class="event-card-body">
        <div class="event-card-meta">
          ${ev.category_name ? `<span class="badge badge-purple">${ev.category_name}</span>` : ''}
          <span class="badge badge-cyan">${timeUntil(ev.event_date)}</span>
        </div>
        <div class="event-card-title">${ev.title}</div>
        <div class="event-card-info">
          <div class="event-card-info-row">
            ${calIcon()} ${formatDate(ev.event_date)}
          </div>
          ${ev.venue ? `<div class="event-card-info-row">${pinIcon()} ${ev.venue}</div>` : ''}
          ${ev.speaker ? `<div class="event-card-info-row">${micIcon()} ${ev.speaker}</div>` : ''}
        </div>
      </div>
      <div class="event-card-footer">
        <span style="font-size:13px;color:var(--text-muted)">
          ${ev.registration_count || 0} registered
        </span>
        <span class="btn btn-outline btn-sm">View →</span>
      </div>
    </div>
  `;
}

/* ── Inline SVG icons ── */
const calIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`;
const pinIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
const micIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>`;
const usersIcon = () => `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`;
