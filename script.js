const API_BASE = 'http://localhost:5000/api/auth';
let currentSessionUser = null;

function setActiveAdminNav(page) {
  const adminNavLinks = document.querySelectorAll('#admin-dashboard-page .sidebar-nav a[data-page]');
  adminNavLinks.forEach((link) => {
    if (link.dataset.page === page) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function showAdminSection(page) {
  const adminSections = document.querySelectorAll('#admin-dashboard-page .admin-section');
  if (!adminSections.length) {
    return;
  }

  adminSections.forEach((section) => section.classList.add('hidden'));

  const sectionMap = {
    'admin-dashboard': ['admin-section-overview', 'admin-section-security-monitoring', 'admin-section-logs'],
    'manage-users': ['admin-section-manage-users'],
    'role-management': ['admin-section-role-management'],
    logs: ['admin-section-logs'],
    'security-monitoring': ['admin-section-security-monitoring'],
  };

  const sectionIds = sectionMap[page] || sectionMap['admin-dashboard'];
  sectionIds.forEach((sectionId) => {
    const section = document.getElementById(sectionId);
    if (section) {
      section.classList.remove('hidden');
    }
  });

  setActiveAdminNav(page);
}

function navigate(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));

  const pageMap = {
    landing: 'landing-page',
    login: 'login-page',
    register: 'register-page',
    'user-dashboard': 'user-dashboard-page',
    profile: 'profile-page',
    'admin-dashboard': 'admin-dashboard-page',
    'manage-users': 'admin-dashboard-page',
    'role-management': 'admin-dashboard-page',
    logs: 'admin-dashboard-page',
    'security-monitoring': 'admin-dashboard-page',
    403: 'access-denied-page',
  };

  const targetPage = pageMap[page] || 'landing-page';
  const pageEl = document.getElementById(targetPage);
  if (pageEl) {
    pageEl.classList.remove('hidden');
  }

  if (targetPage === 'admin-dashboard-page') {
    showAdminSection(page);
  }
}

function showError(containerId, textId, message) {
  const container = document.getElementById(containerId);
  const textEl = document.getElementById(textId);
  if (textEl) {
    textEl.textContent = message;
  }
  if (container) {
    container.classList.remove('hidden');
  }
}

function hideError(containerId) {
  const container = document.getElementById(containerId);
  if (container) {
    container.classList.add('hidden');
  }
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent = value;
  }
}

function toTitleCase(value) {
  if (!value) return '-';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function deriveUsername(user) {
  if (!user) return '-';
  if (user.username && String(user.username).trim()) return user.username.trim();
  if (user.name && String(user.name).trim()) {
    return user.name.trim().toLowerCase().replace(/\s+/g, '_');
  }
  if (user.email && String(user.email).includes('@')) {
    return user.email.split('@')[0];
  }
  return '-';
}

function getInitial(value) {
  if (!value || !String(value).trim()) {
    return '-';
  }
  return String(value).trim().charAt(0).toUpperCase();
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status) {
  const normalized = String(status || 'unknown').toLowerCase();
  const isSuccess = normalized === 'success';
  const label = isSuccess ? 'Success' : normalized === 'blocked' ? 'Blocked' : 'Failed';
  return `<span class="badge ${isSuccess ? 'badge-success' : 'badge-danger'}">${label}</span>`;
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  let data = {};
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }

  return { response, data };
}

async function fetchCurrentUser() {
  const { response, data } = await apiRequest('/me', { method: 'GET' });
  if (!response.ok) return null;
  return data.user || null;
}

async function fetchMyActivity(limit = 10) {
  const { response, data } = await apiRequest(`/activity/me?limit=${limit}`, { method: 'GET' });
  if (!response.ok) return [];
  return data.activities || [];
}

async function fetchAdminOverview() {
  const { response, data } = await apiRequest('/admin/overview', { method: 'GET' });
  if (!response.ok) return null;
  return data.stats || null;
}

async function fetchRecentAdminLogins(limit = 20) {
  const { response, data } = await apiRequest(`/admin/recent-logins?limit=${limit}`, { method: 'GET' });
  if (!response.ok) return [];
  return data.activities || [];
}

function renderUserDashboard(user, activities) {
  setText('user-navbar-name', user?.name || user?.email || '-');
  setText('user-navbar-initial', getInitial(user?.name || user?.email));
  setText('user-dashboard-welcome', `Welcome back, ${user?.name || deriveUsername(user)}`);
  setText('user-role-value', toTitleCase(user?.role || 'user'));

  const latestAttempt = activities[0];
  const lastSuccess = activities.find((item) => item.status === 'success') || latestAttempt;

  setText('user-last-login-value', formatDateTime(lastSuccess?.loginAt));
  setText('user-current-ip-value', latestAttempt?.ipAddress || '-');
  setText('user-current-status-value', `Status: ${toTitleCase(latestAttempt?.status || '-')}`);

  const body = document.getElementById('user-recent-activity-body');
  if (!body) return;

  if (!activities.length) {
    body.innerHTML = '<tr><td colspan="4" style="color: #9CA3AF;">No activity yet</td></tr>';
    return;
  }

  body.innerHTML = activities
    .map((item) => {
      const userAgent = item.userAgent || 'Unknown device';
      return `
        <tr>
          <td>${escapeHtml(formatDateTime(item.loginAt))}</td>
          <td>${escapeHtml(item.ipAddress || '-')}</td>
          <td>${escapeHtml(userAgent)}</td>
          <td>${statusBadge(item.status)}</td>
        </tr>
      `;
    })
    .join('');
}

function renderProfile(user) {
  setText('profile-navbar-name', user?.name || user?.email || '-');
  setText('profile-navbar-initial', getInitial(user?.name || user?.email));
  setText('profile-name-value', user?.name || '-');
  setText('profile-username-value', deriveUsername(user));
  setText('profile-email-value', user?.email || '-');
  setText('profile-role-value', toTitleCase(user?.role || '-'));
  setText('profile-created-at-value', formatDateTime(user?.createdAt));
}

function renderAdminDashboard(user, stats, activities) {
  setText('admin-navbar-name', user?.name || user?.email || '-');
  setText('admin-navbar-initial', getInitial(user?.name || user?.email));

  setText('admin-total-users-value', String(stats?.totalUsers ?? '-'));
  setText('admin-recent-success-value', String(stats?.recentSuccessLogins ?? '-'));
  setText('admin-recent-failed-value', String(stats?.recentFailedLogins ?? '-'));
  setText('admin-blocked-accounts-value', String(stats?.blockedAccounts ?? '-'));

  const latest = activities[0];
  if (latest) {
    const who = latest.email || latest.name || latest.identifier || 'Unknown user';
    setText('admin-latest-login-alert', `${who} login ${latest.status}`);
    setText('admin-latest-login-time', formatDateTime(latest.loginAt));
  } else {
    setText('admin-latest-login-alert', 'Waiting for login activity...');
    setText('admin-latest-login-time', '-');
  }

  const body = document.getElementById('admin-recent-logs-body');
  if (!body) return;

  if (!activities.length) {
    body.innerHTML = '<tr><td colspan="5" style="color: #9CA3AF;">No login activity yet</td></tr>';
    return;
  }

  body.innerHTML = activities
    .map((item) => {
      const who = item.email || item.name || item.identifier || '-';
      return `
        <tr>
          <td>${escapeHtml(who)}</td>
          <td>${escapeHtml(item.ipAddress || '-')}</td>
          <td>${escapeHtml(item.userAgent || 'Unknown device')}</td>
          <td>${escapeHtml(formatDateTime(item.loginAt))}</td>
          <td>${statusBadge(item.status)}</td>
        </tr>
      `;
    })
    .join('');
}

async function refreshUserViews() {
  const [user, activities] = await Promise.all([fetchCurrentUser(), fetchMyActivity(10)]);
  if (!user) return;
  currentSessionUser = user;
  renderUserDashboard(user, activities);
  renderProfile(user);
}

async function refreshAdminViews() {
  const [user, stats, activities] = await Promise.all([
    fetchCurrentUser(),
    fetchAdminOverview(),
    fetchRecentAdminLogins(20),
  ]);
  if (!user) return;
  currentSessionUser = user;
  renderAdminDashboard(user, stats, activities);
}

async function handleLogin(event) {
  event.preventDefault();

  const loginId = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value.trim();

  if (!loginId || !password) {
    showError('login-error', 'login-error-text', 'Please fill in all fields');
    return false;
  }

  hideError('login-error');

  try {
    const { response, data } = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({
        identifier: loginId,
        password,
      }),
    });

    if (!response.ok) {
      showError('login-error', 'login-error-text', data.message || 'Login failed');
      return false;
    }

    currentSessionUser = data.user || null;
    const role = data?.user?.role || 'user';
    if (role === 'admin') {
      navigate('admin-dashboard');
      await refreshAdminViews();
    } else {
      navigate('user-dashboard');
      await refreshUserViews();
    }
  } catch (error) {
    showError('login-error', 'login-error-text', 'Unable to connect to backend on port 5000');
  }

  return false;
}

async function handleRegister(event) {
  event.preventDefault();

  const name = document.getElementById('register-name')?.value.trim() || '';
  const email = document.getElementById('register-email')?.value.trim() || '';
  const password = document.getElementById('register-password')?.value || '';
  const confirmPassword = document.getElementById('register-confirm-password')?.value || '';
  const termsAccepted = Boolean(document.getElementById('register-terms')?.checked);

  if (!name || !email || !password || !confirmPassword) {
    showError('register-error', 'register-error-text', 'Please fill in all fields');
    return false;
  }

  if (password !== confirmPassword) {
    showError('register-error', 'register-error-text', 'Passwords do not match');
    return false;
  }

  if (!termsAccepted) {
    showError('register-error', 'register-error-text', 'Please accept Terms & Conditions');
    return false;
  }

  hideError('register-error');

  try {
    const registerResult = await apiRequest('/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });

    if (!registerResult.response.ok) {
      showError(
        'register-error',
        'register-error-text',
        registerResult.data.message || 'Registration failed'
      );
      return false;
    }

    const loginResult = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ identifier: email, password }),
    });

    if (!loginResult.response.ok) {
      navigate('login');
      return false;
    }

    currentSessionUser = loginResult.data.user || null;
    const role = loginResult.data?.user?.role || 'user';
    if (role === 'admin') {
      navigate('admin-dashboard');
      await refreshAdminViews();
    } else {
      navigate('user-dashboard');
      await refreshUserViews();
    }
  } catch (error) {
    showError('register-error', 'register-error-text', 'Unable to connect to backend on port 5000');
  }

  return false;
}

async function handleLogout(event) {
  if (event) {
    event.preventDefault();
  }

  try {
    await apiRequest('/logout', { method: 'POST' });
  } catch (error) {
    // Ignore network errors on logout and reset UI state anyway.
  }

  currentSessionUser = null;
  navigate('login');
  return false;
}

function updatePasswordStrength(password) {
  const container = document.getElementById('password-strength-container');
  const bar = document.getElementById('password-strength-bar');
  const label = document.getElementById('password-strength-label');

  if (!container || !bar || !label) {
    return;
  }

  if (!password) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');

  let strength = 0;
  if (password.length >= 8) strength += 25;
  if (password.match(/[a-z]/)) strength += 25;
  if (password.match(/[A-Z]/)) strength += 25;
  if (password.match(/[0-9]/)) strength += 25;

  bar.style.width = `${strength}%`;

  if (strength < 50) {
    bar.style.background = '#EF4444';
    label.textContent = 'Weak';
    label.style.color = '#EF4444';
  } else if (strength < 75) {
    bar.style.background = '#F59E0B';
    label.textContent = 'Medium';
    label.style.color = '#F59E0B';
  } else {
    bar.style.background = '#10B981';
    label.textContent = 'Strong';
    label.style.color = '#10B981';
  }
}

async function checkExistingSession() {
  try {
    const { response, data } = await apiRequest('/dashboard', { method: 'GET' });
    if (!response.ok) {
      return;
    }

    if (data?.user?.role === 'admin') {
      navigate('admin-dashboard');
      await refreshAdminViews();
    } else {
      navigate('user-dashboard');
      await refreshUserViews();
    }
  } catch (error) {
    // No active session or backend unavailable.
  }
}

document.addEventListener('DOMContentLoaded', function onReady() {
  navigate('landing');

  const timestampEl = document.getElementById('error-timestamp');
  if (timestampEl) {
    timestampEl.textContent = new Date().toISOString();
  }

  checkExistingSession();
});
