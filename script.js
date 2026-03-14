const API_BASE = 'http://localhost:5000/api/auth';
const ADMIN_API_BASE = 'http://localhost:5000/api/admin';
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

  // Load content for the active section
  if (page === 'manage-users') {
    loadManageUsers();
  } else if (page === 'logs') {
    loadLogs();
  } else if (page === 'security-monitoring') {
    loadSecurityMonitoring();
  } else if (page === 'admin-dashboard') {
    // Refresh admin dashboard data
    refreshAdminViews();
  }

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

  // Load profile data when navigating to profile page
  if (targetPage === 'profile-page') {
    loadProfilePage();
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

async function fetchRecentAdminLogins(limit = 20, params = {}) {
  const query = new URLSearchParams({ limit: String(limit) });
  if (params.status) query.set('status', params.status);
  if (params.user) query.set('user', params.user);
  if (params.from) query.set('from', params.from);
  if (params.to) query.set('to', params.to);
  const { response, data } = await apiRequest(`/admin/recent-logins?${query.toString()}`, { method: 'GET' });
  if (!response.ok) return [];
  return data.activities || [];
}

// Admin API fetch functions for new endpoints
async function fetchAdminStats() {
  const { response, data } = await fetch(`${ADMIN_API_BASE}/stats`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  return data;
}

async function fetchSecurityAlerts() {
  const { response, data } = await fetch(`${ADMIN_API_BASE}/security-alerts`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return [];
  return data.data || [];
}

async function fetchActivityLogs(status = 'all') {
  const { response, data } = await fetch(`${ADMIN_API_BASE}/activity-logs?status=${status}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return [];
  return data.data || [];
}

async function fetchSystemHealth() {
  const { response, data } = await fetch(`${ADMIN_API_BASE}/system-health`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  return data;
}

async function fetchUserProfile() {
  const { response, data } = await fetch(`${API_BASE}/user/profile`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  return data.user || null;
}

async function sendPasswordResetEmail(email) {
  const { response, data } = await fetch(`${API_BASE}/send-reset-email`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  return { ok: response.ok, data };
}

// Load profile page data
async function loadProfilePage() {
  const user = await fetchUserProfile();
  if (user) {
    currentSessionUser = user;
    renderProfile(user);
  }
}

// Fetch all users for admin
async function fetchAllUsers(page = 1, limit = 20) {
  const { response, data } = await apiRequest(`/admin/users?page=${page}&limit=${limit}`, { method: 'GET' });
  if (!response.ok) return { users: [], pagination: {} };
  return data;
}

// Toggle user block status
async function toggleUserBlock(userId, isBlocked) {
  const { response, data } = await apiRequest(`/admin/users/${userId}/toggle-block`, {
    method: 'POST',
    body: JSON.stringify({ isBlocked }),
  });
  if (!response.ok) {
    alert(data?.message || 'Failed to update user status');
    return false;
  }
  return true;
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
    return false;
  }
  const { response, data } = await apiRequest(`/admin/users/${userId}`, { method: 'DELETE' });
  if (!response.ok) {
    alert(data?.message || 'Failed to delete user');
    return false;
  }
  return true;
}

// Render manage users content
async function loadManageUsers() {
  const content = document.getElementById('manage-users-content');
  if (!content) return;

  try {
    const { users, pagination } = await fetchAllUsers();
    
    if (!users || users.length === 0) {
      content.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;"><p>No users found</p></div>';
      return;
    }

    content.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td>${escapeHtml(user.name || '-')}</td>
              <td>${escapeHtml(user.email || '-')}</td>
              <td>${toTitleCase(user.role || 'user')}</td>
              <td>${user.isBlocked ? '<span class="badge badge-danger">Blocked</span>' : '<span class="badge badge-success">Active</span>'}</td>
              <td>${formatDateTime(user.createdAt)}</td>
              <td>
                <button class="btn btn-sm btn-secondary" onclick="handleEditUser('${user._id}')">Edit</button>
                ${!user.isBlocked 
                  ? `<button class="btn btn-sm btn-danger" onclick="handleBlockUser('${user._id}', true)">Block</button>`
                  : `<button class="btn btn-sm btn-success" onclick="handleBlockUser('${user._id}', false)">Unblock</button>`
                }
                <button class="btn btn-sm btn-outline" onclick="handleDeleteUser('${user._id}')">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (error) {
    content.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;"><p>Failed to load users</p></div>';
  }
}

// Handle block user
async function handleBlockUser(userId, isBlocked) {
  const success = await toggleUserBlock(userId, isBlocked);
  if (success) {
    await loadManageUsers();
    await refreshAdminViews();
  }
}

// Handle delete user
async function handleDeleteUser(userId) {
  const success = await deleteUser(userId);
  if (success) {
    await loadManageUsers();
    await refreshAdminViews();
  }
}

// Handle edit user (placeholder)
function handleEditUser(userId) {
  alert('Edit user functionality - User ID: ' + userId);
}

// Load logs content
async function loadLogs() {
  const body = document.getElementById('admin-logs-body');
  if (!body) return;

  try {
    const statusFilter = document.getElementById('logs-filter-status')?.value || 'all';
    const activities = await fetchActivityLogs(statusFilter);

    if (!activities || !activities.length) {
      body.innerHTML = '<tr><td colspan="5" style="color: #9CA3AF;">No logs available</td></tr>';
      return;
    }

    body.innerHTML = activities.map(item => {
      const statusClass = item.loginStatus === 'success' ? 'badge-success' : (item.loginStatus === 'blocked' ? 'badge-danger' : 'badge-warning');
      const statusLabel = item.loginStatus === 'success' ? 'Success' : (item.loginStatus === 'blocked' ? 'Blocked' : 'Failed');
      return `
        <tr>
          <td>${escapeHtml(item.username || '-')}</td>
          <td>${escapeHtml(item.ipAddress || '-')}</td>
          <td>${escapeHtml(item.device || 'Desktop')}</td>
          <td>${escapeHtml(formatDateTime(item.timestamp))}</td>
          <td><span class="badge ${statusClass}">${statusLabel}</span></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    body.innerHTML = '<tr><td colspan="5" style="color: #EF4444;">Failed to load logs</td></tr>';
  }
}

// Filter logs
function filterLogs() {
  loadLogs();
}

// Load security monitoring content
async function loadSecurityMonitoring() {
  const alertsBody = document.getElementById('security-alerts-body');
  const blockedBody = document.getElementById('blocked-accounts-body');

  try {
    // Fetch alerts (failed and blocked logins)
    const alerts = await fetchSecurityAlerts();
    const blockedUsers = await fetchAllUsers(1, 100);
    const blocked = blockedUsers.users?.filter(u => u.isBlocked) || [];

    // Render alerts
    if (alertsBody) {
      if (!alerts || alerts.length === 0) {
        alertsBody.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;"><p>No security alerts</p></div>';
      } else {
        alertsBody.innerHTML = alerts.map(a => {
          const cls = a.loginStatus === 'blocked' ? 'alert-danger' : 'alert-warning';
          return `
            <div class="alert ${cls}" style="margin-bottom: 12px;">
              <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
              </svg>
              <div>
                <p>${escapeHtml(a.username || '-')} — ${escapeHtml(a.alertType || 'Alert')}</p>
                <p class="text-sm" style="margin-top: 4px;">${escapeHtml(formatDateTime(a.timestamp))}</p>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render blocked accounts
    if (blockedBody) {
      if (!blocked.length) {
        blockedBody.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;"><p>No blocked accounts</p></div>';
      } else {
        blockedBody.innerHTML = blocked.map(user => `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #2D3748;">
            <div>
              <p>${escapeHtml(user.name || '-')}</p>
              <p class="text-sm text-secondary">${escapeHtml(user.email || '-')}</p>
            </div>
            <button class="btn btn-sm btn-success" onclick="handleBlockUser('${user._id}', false)">Unblock</button>
          </div>
        `).join('');
      }
    }
  } catch (error) {
    if (alertsBody) alertsBody.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;"><p>Failed to load security data</p></div>';
    if (blockedBody) blockedBody.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;"><p>Failed to load blocked accounts</p></div>';
  }
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
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  
  setText('profile-navbar-name', user?.name || user?.email || '-');
  setText('profile-navbar-initial', getInitial(user?.name || user?.email));
  setText('profile-name-value', user?.name || '-');
  setText('profile-username-value', deriveUsername(user));
  setText('profile-email-value', user?.email || '-');
  setText('profile-role-value', toTitleCase(user?.role || '-'));
  setText('profile-created-at-value', formatDate(user?.createdAt));
}

function renderAdminDashboard(user, stats, activities) {
  setText('admin-navbar-name', user?.name || user?.email || '-');
  setText('admin-navbar-initial', getInitial(user?.name || user?.email));

  setText('admin-total-users-value', String(stats?.totalUsers ?? '-'));
  setText('admin-recent-success-value', String(stats?.activeSessions ?? stats?.recentSuccessLogins ?? '-'));
  setText('admin-recent-failed-value', String(stats?.failedLogins ?? stats?.recentFailedLogins ?? '-'));
  setText('admin-blocked-logins-value', String(stats?.blockedLogins ?? '-'));

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
      const device = item.deviceName || (item.userAgent || 'Unknown device');
      return `
        <tr>
          <td>${escapeHtml(who)}</td>
          <td>${escapeHtml(item.ipAddress || '-')}</td>
          <td>${escapeHtml(device)}</td>
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
  const [user, stats, activities, alerts, health] = await Promise.all([
    fetchCurrentUser(),
    fetchAdminStats(),
    fetchActivityLogs('all'),
    fetchSecurityAlerts(),
    fetchSystemHealth(),
  ]);
  if (!user) return;
  currentSessionUser = user;
  
  // Update stats cards
  setText('admin-total-users-value', String(stats?.totalUsers ?? '-'));
  setText('admin-recent-success-value', String(stats?.activeSessions ?? '-'));
  setText('admin-recent-failed-value', String(stats?.failedLogins ?? '-'));
  setText('admin-blocked-logins-value', String(stats?.blockedLogins ?? '-'));
  
  // Update recent logs table
  const recentLogsBody = document.getElementById('admin-recent-logs-body');
  if (recentLogsBody) {
    if (!activities || activities.length === 0) {
      recentLogsBody.innerHTML = '<tr><td colspan="5" style="color: #9CA3AF;">No login activity yet</td></tr>';
    } else {
      recentLogsBody.innerHTML = activities.slice(0, 10).map(item => {
        const statusClass = item.loginStatus === 'success' ? 'badge-success' : (item.loginStatus === 'blocked' ? 'badge-danger' : 'badge-warning');
        const statusLabel = item.loginStatus === 'success' ? 'Success' : (item.loginStatus === 'blocked' ? 'Blocked' : 'Failed');
        return `
          <tr>
            <td>${escapeHtml(item.username || '-')}</td>
            <td>${escapeHtml(item.ipAddress || '-')}</td>
            <td>${escapeHtml(item.device || 'Desktop')}</td>
            <td>${escapeHtml(formatDateTime(item.timestamp))}</td>
            <td><span class="badge ${statusClass}">${statusLabel}</span></td>
          </tr>
        `;
      }).join('');
    }
  }
  
  // Update security alerts
  const alertsBody = document.getElementById('admin-alerts-body');
  if (alertsBody) {
    if (!alerts || alerts.length === 0) {
      alertsBody.innerHTML = '<div class="text-secondary">No security alerts</div>';
    } else {
      alertsBody.innerHTML = alerts.map(a => {
        const cls = a.loginStatus === 'blocked' ? 'alert-danger' : 'alert-warning';
        return `
          <div class="alert ${cls}">
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <p>${escapeHtml(a.username || '-')} — ${escapeHtml(a.alertType || 'Alert')}</p>
              <p class="text-sm" style="margin-top: 4px;">${escapeHtml(formatDateTime(a.timestamp))}</p>
            </div>
          </div>
        `;
      }).join('');
    }
  }
  
  // Update system health
  updateSystemHealth(health);
  
  // Update navbar
  setText('admin-navbar-name', user?.name || user?.email || '-');
  setText('admin-navbar-initial', getInitial(user?.name || user?.email));
}

function updateSystemHealth(health) {
  if (!health) return;
  
  // Find all health status elements and update them
  const healthStatuses = document.querySelectorAll('.health-status');
  const healthData = [
    { key: 'authService', index: 0 },
    { key: 'database', index: 1 },
    { key: 'apiGateway', index: 2 },
    { key: 'securityScanner', index: 3 },
  ];
  
  healthData.forEach(item => {
    const status = health[item.key];
    const statusEl = healthStatuses[item.index];
    if (statusEl && status) {
      const dot = statusEl.querySelector('.health-dot');
      const text = statusEl.querySelector('span');
      
      if (status === 'healthy') {
        statusEl.className = 'health-status health-healthy';
        if (dot) dot.style.background = '#10B981';
        if (text) {
          text.style.color = '#10B981';
          text.textContent = 'Healthy';
        }
      } else {
        statusEl.className = 'health-status health-warning';
        if (dot) dot.style.background = '#F59E0B';
        if (text) {
          text.style.color = '#F59E0B';
          text.textContent = 'Warning';
        }
      }
    }
  });
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

async function handleSendResetEmail() {
  try {
    const user = currentSessionUser || (await fetchUserProfile());
    if (!user?.email) {
      alert('Unable to get user email');
      return;
    }
    
    const result = await sendPasswordResetEmail(user.email);
    
    if (result.ok) {
      alert(result.data?.message || 'Password reset email has been sent');
    } else {
      alert(result.data?.message || 'Failed to send password reset email');
    }
  } catch (e) {
    alert('An error occurred while sending the password reset email');
  }
}
