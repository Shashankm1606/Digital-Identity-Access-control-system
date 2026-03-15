const API_BASE = 'http://localhost:5000/api/auth';
const ADMIN_API_BASE = 'http://localhost:5000/api/admin';
let currentSessionUser = null;
let currentLoginType = '';

// Show login modal based on type (admin or user)
function showLoginModal(type) {
  currentLoginType = type;
  const loginTypeInput = document.getElementById('login-type');
  const loginTypeBanner = document.getElementById('login-type-banner');
  const loginTypeText = document.getElementById('login-type-text');
  
  if (loginTypeInput) loginTypeInput.value = type;
  
  if (type === 'admin') {
    if (loginTypeBanner) {
      loginTypeBanner.classList.remove('hidden');
      loginTypeBanner.classList.add('alert-info');
      loginTypeBanner.style.borderLeft = '3px solid #9d4edd';
    }
    if (loginTypeText) loginTypeText.textContent = 'ADMIN LOGIN - Enter admin credentials';
  } else {
    if (loginTypeBanner) {
      loginTypeBanner.classList.remove('hidden');
      loginTypeBanner.classList.add('alert-info');
      loginTypeBanner.style.borderLeft = '3px solid #00d4ff';
    }
    if (loginTypeText) loginTypeText.textContent = 'USER LOGIN - Enter user or manager credentials';
  }
  
  navigate('login');
}

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

function showAdminPage(pageId) {
  
  // Hide every single admin page section
  const allPages = document.querySelectorAll('.admin-page');
  allPages.forEach(function(page) {
    page.style.display = 'none';
  });
  
  // Show only the requested section
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
  } else {
    console.error('Page not found:', pageId);
    return;
  }
  
  // Update active state on sidebar
  const allNavItems = document.querySelectorAll('[data-page]');
  allNavItems.forEach(function(item) {
    item.classList.remove('active');
  });
  const activeItem = document.querySelector('[data-page="' + pageId + '"]');
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  // Load data for the page that was just shown
  const loaders = {
    'admin-home': () => refreshAdminViews(),
    'admin-manage-users': () => loadManageUsers(),
    'admin-role-mgmt': () => loadRoleManagement(),
    'admin-logs': () => loadActivityLogs('all'),
    'admin-security': () => loadSecurityMonitoring(),
    'admin-create-admin': () => console.log('Admin create page loaded')
  };
  
  if (loaders[pageId]) {
    loaders[pageId]();
  }
}

// Manager Dashboard Page Navigation
function showManagerPage(pageId) {
  // Hide every single manager page section
  const allPages = document.querySelectorAll('.manager-page');
  allPages.forEach(function(page) {
    page.style.display = 'none';
  });
  
  // Show only the requested section
  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.style.display = 'block';
  } else {
    console.error('Manager page not found:', pageId);
    return;
  }
  
  // Update active state on sidebar
  const allNavItems = document.querySelectorAll('[data-manager-page]');
  allNavItems.forEach(function(item) {
    item.classList.remove('active');
  });
  const activeItem = document.querySelector('[data-manager-page="' + pageId + '"]');
  if (activeItem) {
    activeItem.classList.add('active');
  }
  
  // Load data for the page that was just shown
  const loaders = {
    'manager-home': () => refreshManagerViews(),
    'manager-assign-task': () => loadAssignTask(),
    'manager-manage-tasks': () => loadManagerTasks(),
    'manager-team-members': () => loadTeamMembers(),
    'manager-activity-logs': () => loadManagerActivityLogs(),
    'manager-reports': () => loadReports(),
    'manager-notifications': () => loadManagerNotifications(),
    'manager-profile': () => loadManagerProfile()
  };
  
  if (loaders[pageId]) {
    loaders[pageId]();
  }
}

// Placeholder function for refreshManagerViews
async function refreshManagerViews() {
  console.log('Loading manager dashboard...');
  
  const user = await fetchCurrentUser();
  if (!user) {
    handleLogout();
    return;
  }
  
  currentSessionUser = user;
  
  // Update navbar
  setText('manager-navbar-name', user?.name || user?.email || '-');
  setText('manager-navbar-initial', getInitial(user?.name || user?.email));
  setText('manager-profile-name', user?.name || '-');
  setText('manager-profile-email', user?.email || '-');
  setText('manager-profile-role', (user?.role || 'manager').toUpperCase());
  setText('manager-profile-name-value', user?.name || '-');
  setText('manager-profile-email-value', user?.email || '-');
  setText('manager-profile-role-value', (user?.role || 'manager').toUpperCase());
  
  // Fetch and display stats
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/stats`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const stats = await res.json();
      setText('manager-team-members-value', String(stats?.teamMembers ?? '-'));
      setText('manager-tasks-assigned-value', String(stats?.tasksAssigned ?? '-'));
      setText('manager-tasks-completed-value', String(stats?.tasksCompleted ?? '-'));
      setText('manager-pending-tasks-value', String(stats?.pendingTasks ?? '-'));
      setText('manager-overdue-tasks-value', String(stats?.overdueTasks ?? '-'));
    }
  } catch (err) {
    console.error('Failed to fetch manager stats:', err);
  }
  
  // Load recent activities
  loadManagerActivities();
}

// Load manager activities
async function loadManagerActivities() {
  const body = document.getElementById('manager-recent-activities-body');
  if (!body) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/activity-logs`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const activities = data.data || [];
      
      if (activities.length === 0) {
        body.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;"><p>No recent activities</p></div>';
        return;
      }
      
      body.innerHTML = activities.slice(0, 5).map(item => `
        <div style="padding: 12px; border-bottom: 1px solid var(--border-color);">
          <p style="color: var(--text-primary);">${escapeHtml(item.username || '-')} - ${escapeHtml(item.action || 'Activity')}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${formatDateTime(item.timestamp)}</p>
        </div>
      `).join('');
    }
  } catch (err) {
    body.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;"><p>Failed to load activities</p></div>';
  }
}

// Load assign task page
async function loadAssignTask() {
  const select = document.getElementById('task-assign-to-input');
  if (!select) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/team-members`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const members = data.users || [];
      
      select.innerHTML = '<option value="">Select team member</option>' +
        members.map(m => `<option value="${m._id}">${escapeHtml(m.name || m.email)}</option>`).join('');
    }
  } catch (err) {
    console.error('Failed to load team members:', err);
  }
}

// Handle assign task
async function handleAssignTask(event) {
  event.preventDefault();
  
  const title = document.getElementById('task-title-input')?.value.trim();
  const description = document.getElementById('task-desc-input')?.value.trim();
  const assignedTo = document.getElementById('task-assign-to-input')?.value;
  const priority = document.getElementById('task-priority-input')?.value;
  const dueDate = document.getElementById('task-deadline-input')?.value;
  
  if (!title || !assignedTo || !dueDate) {
    alert('Please fill in all required fields');
    return;
  }
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/tasks`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, assignedTo, priority, dueDate })
    });
    
    if (res.ok) {
      alert('TASK ASSIGNED SUCCESSFULLY');
      // Clear form
      document.getElementById('task-title-input').value = '';
      document.getElementById('task-desc-input').value = '';
      document.getElementById('task-assign-to-input').value = '';
      document.getElementById('task-priority-input').value = 'medium';
      document.getElementById('task-deadline-input').value = '';
      
      showManagerPage('manager-manage-tasks');
    } else {
      alert('Failed to assign task');
    }
  } catch (err) {
    alert('Error assigning task');
  }
}

// Load manager tasks
async function loadManagerTasks() {
  const body = document.getElementById('manager-tasks-body');
  if (!body) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/tasks`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const tasks = data.tasks || [];
      
      if (tasks.length === 0) {
        body.innerHTML = '<tr><td colspan="7" style="color: #9CA3AF; text-align: center;">No tasks assigned</td></tr>';
        return;
      }
      
      body.innerHTML = tasks.map(task => {
        const priorityClass = task.priority === 'high' ? 'badge-danger' : (task.priority === 'medium' ? 'badge-warning' : 'badge-success');
        const statusClass = task.status === 'completed' ? 'badge-success' : (task.status === 'pending' ? 'badge-warning' : 'badge-info');
        
        return `
          <tr>
            <td>${String(task._id).substring(0, 8)}...</td>
            <td>${escapeHtml(task.title || '-')}</td>
            <td>${escapeHtml(task.assignedTo?.name || task.assignedTo?.email || '-')}</td>
            <td><span class="badge ${priorityClass}">${(task.priority || 'low').toUpperCase()}</span></td>
            <td>${task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '-'}</td>
            <td><span class="badge ${statusClass}">${(task.status || 'pending').toUpperCase()}</span></td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="viewManagerTask('${task._id}')">VIEW</button>
              ${task.status === 'completed' ? `<button class="btn btn-sm btn-success" onclick="approveManagerTask('${task._id}')">APPROVE</button>` : ''}
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    body.innerHTML = '<tr><td colspan="7" style="color: #EF4444; text-align: center;">Failed to load tasks</td></tr>';
  }
}

// Load team members
async function loadTeamMembers() {
  const body = document.getElementById('manager-team-body');
  if (!body) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/team-members`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const members = data.users || [];
      
      if (members.length === 0) {
        body.innerHTML = '<tr><td colspan="6" style="color: #9CA3AF; text-align: center;">No team members</td></tr>';
        return;
      }
      
      body.innerHTML = members.map(m => `
        <tr>
          <td>${escapeHtml(m.name || '-')}</td>
          <td>${escapeHtml(m.email || '-')}</td>
          <td><span class="badge badge-success">${(m.role || 'user').toUpperCase()}</span></td>
          <td>${m.lastLogin ? formatDateTime(m.lastLogin) : '-'}</td>
          <td>${m.taskCount || 0}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewTeamMember('${m._id}')">VIEW</button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    body.innerHTML = '<tr><td colspan="6" style="color: #EF4444; text-align: center;">Failed to load team members</td></tr>';
  }
}

// Load manager activity logs
async function loadManagerActivityLogs() {
  const body = document.getElementById('manager-activity-logs-body');
  if (!body) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/activity-logs`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const logs = data.data || [];
      
      if (logs.length === 0) {
        body.innerHTML = '<tr><td colspan="5" style="color: #9CA3AF; text-align: center;">No activity logs</td></tr>';
        return;
      }
      
      body.innerHTML = logs.map(log => {
        const statusClass = log.loginStatus === 'success' ? 'badge-success' : (log.loginStatus === 'blocked' ? 'badge-danger' : 'badge-warning');
        return `
          <tr>
            <td>${escapeHtml(log.username || '-')}</td>
            <td>${escapeHtml(log.action || 'LOGIN')}</td>
            <td>${escapeHtml(log.ipAddress || '-')}</td>
            <td>${formatDateTime(log.timestamp)}</td>
            <td><span class="badge ${statusClass}">${(log.loginStatus || 'unknown').toUpperCase()}</span></td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    body.innerHTML = '<tr><td colspan="5" style="color: #EF4444; text-align: center;">Failed to load activity logs</td></tr>';
  }
}

// Reports placeholder
async function loadReports() {
  console.log('Loading reports...');
}

function showReport(type) {
  console.log('Showing report:', type);
}

function exportReportCSV() {
  alert('Export CSV functionality');
}

function exportReportPDF() {
  window.print();
}

// Notifications placeholder
async function loadManagerNotifications() {
  const body = document.getElementById('manager-notifications-body');
  if (!body) return;
  
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    const res = await fetch(`${MANAGER_API_BASE}/notifications`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      const notifications = data.notifications || [];
      
      if (notifications.length === 0) {
        body.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;"><p>No notifications</p></div>';
        return;
      }
      
      body.innerHTML = notifications.map(n => `
        <div style="padding: 16px; border-bottom: 1px solid var(--border-color);">
          <p style="color: var(--text-primary);">${escapeHtml(n.message || '-')}</p>
          <p style="font-size: 12px; color: var(--text-secondary); margin-top: 4px;">${formatDateTime(n.createdAt)}</p>
        </div>
      `).join('');
    }
  } catch (err) {
    body.innerHTML = '<div style="text-align: center; padding: 40px; color: #EF4444;"><p>Failed to load notifications</p></div>';
  }
}

async function markAllNotificationsRead() {
  try {
    const MANAGER_API_BASE = 'http://localhost:5000/api/manager';
    await fetch(`${MANAGER_API_BASE}/notifications/read-all`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    loadManagerNotifications();
  } catch (err) {
    console.error('Failed to mark notifications as read');
  }
}

// Profile placeholder
async function loadManagerProfile() {
  console.log('Loading manager profile...');
}

async function handleManagerChangePassword(event) {
  event.preventDefault();
  
  const currentPassword = document.getElementById('manager-current-password')?.value;
  const newPassword = document.getElementById('manager-new-password')?.value;
  const confirmPassword = document.getElementById('manager-confirm-password')?.value;
  
  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Please fill in all password fields');
    return;
  }
  
  if (newPassword !== confirmPassword) {
    alert('New passwords do not match');
    return;
  }
  
  if (newPassword.length < 8) {
    alert('Password must be at least 8 characters');
    return;
  }
  
  try {
    const res = await fetch(`${TASK_API_BASE}/change-password`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword })
    });
    
    if (res.ok) {
      alert('PASSWORD UPDATED SUCCESSFULLY');
      document.getElementById('manager-current-password').value = '';
      document.getElementById('manager-new-password').value = '';
      document.getElementById('manager-confirm-password').value = '';
    } else {
      const data = await res.json();
      alert(data?.message || 'Failed to update password');
    }
  } catch (err) {
    alert('Error updating password');
  }
}

// Toggle manager profile dropdown
function toggleManagerProfileDropdown() {
  const dropdown = document.getElementById('manager-profile-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Check username availability
async function checkUsernameAvailability() {
  const username = document.getElementById('admin-username')?.value.trim();
  if (!username) return;
  
  try {
    const res = await fetch(`${ADMIN_API_BASE}/check-username?username=${encodeURIComponent(username)}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.exists) {
        showError('create-admin-error', 'create-admin-error-text', 'USERNAME ALREADY EXISTS');
      }
    }
  } catch (err) {
    console.error('Error checking username:', err);
  }
}

// Check email availability
async function checkEmailAvailability() {
  const email = document.getElementById('admin-email')?.value.trim();
  if (!email) return;
  
  try {
    const res = await fetch(`${ADMIN_API_BASE}/check-email?email=${encodeURIComponent(email)}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data.exists) {
        showError('create-admin-error', 'create-admin-error-text', 'EMAIL ALREADY REGISTERED');
      }
    }
  } catch (err) {
    console.error('Error checking email:', err);
  }
}

// Handle create admin
async function handleCreateAdmin(event) {
  event.preventDefault();
  
  const fullName = document.getElementById('admin-fullname')?.value.trim();
  const username = document.getElementById('admin-username')?.value.trim();
  const email = document.getElementById('admin-email')?.value.trim();
  const password = document.getElementById('admin-password')?.value;
  const confirmPassword = document.getElementById('admin-confirm-password')?.value;
  const role = document.getElementById('admin-role')?.value;
  
  // Hide previous messages
  hideError('create-admin-error');
  const successEl = document.getElementById('create-admin-success');
  if (successEl) successEl.classList.add('hidden');
  
  // Validation
  if (!fullName || !username || !email || !password || !confirmPassword || !role) {
    showError('create-admin-error', 'create-admin-error-text', 'Please fill in all fields');
    return;
  }
  
  if (password.length < 8) {
    showError('create-admin-error', 'create-admin-error-text', 'Password must be at least 8 characters');
    return;
  }
  
  if (password !== confirmPassword) {
    showError('create-admin-error', 'create-admin-error-text', 'Passwords do not match');
    return;
  }
  
  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showError('create-admin-error', 'create-admin-error-text', 'Invalid email format');
    return;
  }
  
  try {
    const res = await fetch(`${ADMIN_API_BASE}/create-account`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName, username, email, password, role })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      // Show success message
      const successBanner = document.getElementById('create-admin-success');
      const successText = document.getElementById('create-admin-success-text');
      if (successBanner && successText) {
        successText.textContent = `✓ ${role.toUpperCase()} ACCOUNT CREATED FOR ${username}`;
        successBanner.classList.remove('hidden');
      }
      
      // Clear form
      document.getElementById('admin-fullname').value = '';
      document.getElementById('admin-username').value = '';
      document.getElementById('admin-email').value = '';
      document.getElementById('admin-password').value = '';
      document.getElementById('admin-confirm-password').value = '';
      document.getElementById('admin-role').value = '';
      
      // Log activity
      await LoginActivity.create({
        username: username,
        email: email,
        ipAddress: 'N/A',
        loginStatus: 'success',
        alertType: 'Account Created'
      });
      
    } else {
      showError('create-admin-error', 'create-admin-error-text', data.message || 'Failed to create account');
    }
  } catch (err) {
    showError('create-admin-error', 'create-admin-error-text', 'Error creating account');
  }
}

function navigate(page) {
  document.querySelectorAll('.page').forEach((p) => p.classList.add('hidden'));

  const pageMap = {
    landing: 'landing-page',
    login: 'login-page',
    register: 'register-page',
    'user-dashboard': 'user-dashboard-page',
    profile: 'profile-page',
    'user-tasks': 'user-tasks-page',
    'admin-dashboard': 'admin-dashboard-page',
    'manager-dashboard': 'manager-dashboard-page',
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
    // Map page names to admin page IDs
    const adminPageMap = {
      'admin-dashboard': 'admin-home',
      'manage-users': 'admin-manage-users',
      'role-management': 'admin-role-mgmt',
      'logs': 'admin-logs',
      'security-monitoring': 'admin-security'
    };
    showAdminPage(adminPageMap[page] || 'admin-home');
  }

  // Handle manager dashboard pages
  if (targetPage === 'manager-dashboard-page') {
    // Map page names to manager page IDs
    const managerPageMap = {
      'manager-dashboard': 'manager-home',
      'manager-assign-task': 'manager-assign-task',
      'manager-manage-tasks': 'manager-manage-tasks',
      'manager-team-members': 'manager-team-members',
      'manager-activity-logs': 'manager-activity-logs',
      'manager-reports': 'manager-reports',
      'manager-notifications': 'manager-notifications',
      'manager-profile': 'manager-profile'
    };
    showManagerPage(managerPageMap[page] || 'manager-home');
  }

  // Load profile data when navigating to profile page
  if (targetPage === 'profile-page') {
    loadProfilePage();
  }

  // Load tasks data when navigating to tasks page
  if (targetPage === 'user-tasks-page') {
    loadTasks();
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

// Fetch user last login info
async function fetchUserLastLogin() {
  const { response, data } = await fetch(`${TASK_API_BASE}/last-login`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return null;
  return data;
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
  try {
    const res = await fetch(`${ADMIN_API_BASE}/stats`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!res.ok) {
      console.error('fetchAdminStats: HTTP error', res.status, res.statusText);
      return null;
    }
    
    const data = await res.json();
    console.log('fetchAdminStats: Received data', data);
    return data;
  } catch (err) {
    console.error('fetchAdminStats: Error fetching stats:', err);
    return null;
  }
}

async function fetchSecurityAlerts() {
  try {
    const { response, data } = await fetch(`${ADMIN_API_BASE}/security-alerts`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.error('fetchSecurityAlerts: HTTP error', response.status);
      return [];
    }
    return data.data || [];
  } catch (err) {
    console.error('fetchSecurityAlerts: Error:', err);
    return [];
  }
}

async function fetchActivityLogs(status = 'all') {
  try {
    const { response, data } = await fetch(`${ADMIN_API_BASE}/activity-logs?status=${status}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (!response.ok) {
      console.error('fetchActivityLogs: HTTP error', response.status);
      return [];
    }
    return data.data || [];
  } catch (err) {
    console.error('fetchActivityLogs: Error:', err);
    return [];
  }
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

// Task API functions
const TASK_API_BASE = 'http://localhost:5000/api/user';

async function fetchTasks() {
  const { response, data } = await fetch(`${TASK_API_BASE}/tasks`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) return [];
  return data.tasks || [];
}

async function createTask(taskData) {
  const { response, data } = await fetch(`${TASK_API_BASE}/tasks`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
    body: JSON.stringify(taskData),
  });
  if (!response.ok) {
    alert(data?.message || 'Failed to create task');
    return null;
  }
  return data.task;
}

async function completeTask(taskId) {
  const { response, data } = await fetch(`${TASK_API_BASE}/tasks/${taskId}/complete`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });
  if (!response.ok) {
    alert(data?.message || 'Failed to complete task');
    return false;
  }
  return true;
}

async function reopenTask(taskId) {
  const { response, data } = await fetch(`${TASK_API_BASE}/tasks/${taskId}/reopen`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  });
  if (!response.ok) {
    alert(data?.message || 'Failed to reopen task');
    return false;
  }
  return true;
}

async function removeTask(taskId) {
  if (!confirm('CONFIRM: Delete this task? This action cannot be undone.')) {
    return false;
  }
  const { response, data } = await fetch(`${TASK_API_BASE}/tasks/${taskId}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'DELETE',
  });
  if (!response.ok) {
    alert(data?.message || 'Failed to delete task');
    return false;
  }
  return true;
}

// Load tasks and render them
async function loadTasks() {
  const pendingList = document.getElementById('pending-tasks-list');
  const completedList = document.getElementById('completed-tasks-list');
  const pendingCount = document.getElementById('pending-count');
  const completedCount = document.getElementById('completed-count');
  
  // Update navbar
  setText('tasks-navbar-name', currentSessionUser?.name || currentSessionUser?.email || '-');
  setText('tasks-navbar-initial', getInitial(currentSessionUser?.name || currentSessionUser?.email));
  
  if (!pendingList || !completedList) return;

  try {
    const tasks = await fetchTasks();
    
    const pending = tasks.filter(t => t.status === 'pending');
    const completed = tasks.filter(t => t.status === 'completed');
    
    // Update counts
    if (pendingCount) pendingCount.textContent = pending.length;
    if (completedCount) completedCount.textContent = completed.length;
    
    // Render pending tasks
    if (pending.length === 0) {
      pendingList.innerHTML = '<p class="empty-state">NO PENDING TASKS</p>';
    } else {
      pendingList.innerHTML = pending.map(task => renderTaskCard(task, false)).join('');
    }
    
    // Render completed tasks
    if (completed.length === 0) {
      completedList.innerHTML = '<p class="empty-state">NO COMPLETED TASKS</p>';
    } else {
      completedList.innerHTML = completed.map(task => renderTaskCard(task, true)).join('');
    }
  } catch (error) {
    pendingList.innerHTML = '<p class="empty-state">FAILED TO LOAD TASKS</p>';
    completedList.innerHTML = '';
  }
}

function renderTaskCard(task, isCompleted) {
  const priorityClass = `priority-${task.priority || 'low'}`;
  const completedClass = isCompleted ? 'completed' : '';
  const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A';
  
  return `
    <div class="task-card ${priorityClass} ${completedClass}" id="task-${task._id}">
      <div class="task-header">
        <span class="task-title">${escapeHtml(task.title || '-')}</span>
        <span class="priority-badge priority-${task.priority || 'low'}">${(task.priority || 'low').toUpperCase()}</span>
      </div>
      <p class="task-desc">${escapeHtml(task.description || 'No description')}</p>
      <div class="task-footer">
        <span class="task-due">DUE: ${dueDate}</span>
        <div class="task-actions">
          ${!isCompleted 
            ? `<button onclick="handleCompleteTask('${task._id}')" class="btn btn-success btn-sm">MARK_COMPLETE</button>`
            : `<button onclick="handleReopenTask('${task._id}')" class="btn btn-secondary btn-sm">REOPEN</button>`
          }
          <button onclick="handleDeleteTask('${task._id}')" class="btn btn-danger btn-sm">DELETE</button>
        </div>
      </div>
    </div>
  `;
}

async function addTask() {
  const titleInput = document.getElementById('task-title-input');
  const priorityInput = document.getElementById('task-priority-input');
  const dueInput = document.getElementById('task-due-input');
  const descInput = document.getElementById('task-desc-input');
  
  const title = titleInput?.value.trim();
  const priority = priorityInput?.value || 'low';
  const dueDate = dueInput?.value || null;
  const description = descInput?.value.trim() || '';
  
  if (!title) {
    alert('Please enter a task title');
    return;
  }
  
  const taskData = { title, priority, dueDate, description };
  const task = await createTask(taskData);
  
  if (task) {
    // Clear form
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    if (dueInput) dueInput.value = '';
    if (priorityInput) priorityInput.value = 'low';
    
    // Reload tasks
    await loadTasks();
  }
}

async function handleCompleteTask(taskId) {
  const success = await completeTask(taskId);
  if (success) {
    await loadTasks();
  }
}

async function handleReopenTask(taskId) {
  const success = await reopenTask(taskId);
  if (success) {
    await loadTasks();
  }
}

async function handleDeleteTask(taskId) {
  const success = await removeTask(taskId);
  if (success) {
    await loadTasks();
  }
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
          <td>${escapeHtml(item.deviceName || item.device || userAgent)}</td>
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

  // Update profile dropdown
  setText('admin-profile-name', user?.name || '-');
  setText('admin-profile-email', user?.email || '-');
  setText('admin-profile-role', (user?.role || 'admin').toUpperCase());

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
  console.log('refreshAdminViews: Starting...');
  const [user, stats, activities, alerts, health] = await Promise.all([
    fetchCurrentUser(),
    fetchAdminStats(),
    fetchActivityLogs('all'),
    fetchSecurityAlerts(),
    fetchSystemHealth(),
  ]);
  
  console.log('refreshAdminViews: user=', user, 'stats=', stats, 'activities=', activities?.length);
  
  if (!user) {
    console.log('refreshAdminViews: No user, returning');
    return;
  }
  currentSessionUser = user;
  
  // Update stats cards
  console.log('refreshAdminViews: Updating stats cards with', stats);
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
  const loginType = document.getElementById('login-type')?.value || 'user';

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
        loginType: loginType
      }),
    });

    if (!response.ok) {
      showError('login-error', 'login-error-text', data.message || 'Login failed');
      return false;
    }

    currentSessionUser = data.user || null;
    const role = data?.user?.role || 'user';
    
    // Role-based redirection
    if (role === 'admin') {
      navigate('admin-dashboard');
      await refreshAdminViews();
    } else if (role === 'manager') {
      navigate('manager-dashboard');
      await refreshManagerViews();
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
  
  // Clear localStorage and sessionStorage
  localStorage.clear();
  sessionStorage.clear();
  
  // Clear login form fields
  const loginEmail = document.getElementById('login-email');
  const loginPassword = document.getElementById('login-password');
  if (loginEmail) loginEmail.value = '';
  if (loginPassword) loginPassword.value = '';
  
  // Clear register form fields
  const registerName = document.getElementById('register-name');
  const registerEmail = document.getElementById('register-email');
  const registerPassword = document.getElementById('register-password');
  const registerConfirmPassword = document.getElementById('register-confirm-password');
  if (registerName) registerName.value = '';
  if (registerEmail) registerEmail.value = '';
  if (registerPassword) registerPassword.value = '';
  if (registerConfirmPassword) registerConfirmPassword.value = '';
  
  navigate('login');
  return false;
}

// Toggle password visibility
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input) {
    if (input.type === 'password') {
      input.type = 'text';
      btn.style.color = 'var(--accent-primary)';
    } else {
      input.type = 'password';
      btn.style.color = 'var(--text-secondary)';
    }
  }
}

// Toggle admin profile dropdown
function toggleAdminProfileDropdown() {
  const dropdown = document.getElementById('admin-profile-dropdown');
  if (dropdown) {
    dropdown.classList.toggle('hidden');
  }
}

// Close dropdown when clicking outside
document.addEventListener('click', function(event) {
  const dropdown = document.getElementById('admin-profile-dropdown');
  const profileBtn = document.getElementById('admin-profile-btn');
  if (dropdown && profileBtn) {
    if (!dropdown.contains(event.target) && !profileBtn.contains(event.target)) {
      dropdown.classList.add('hidden');
    }
  }
});

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
