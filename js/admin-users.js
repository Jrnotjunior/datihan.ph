window.addEventListener('datihan-auth-ready', loadAdminUsers);

document.addEventListener('DOMContentLoaded', () => {
  if (window.datihanAuthProfile?.role === 'admin') {
    loadAdminUsers();
  }
});

async function loadAdminUsers() {
  const page = document.querySelector('[data-admin-users]');
  if (!page || page.dataset.loaded === 'true') return;

  page.dataset.loaded = 'true';

  const status = page.querySelector('[data-users-status]');
  const tableBody = page.querySelector('[data-users-body]');
  const emptyState = page.querySelector('[data-users-empty]');
  const filter = page.querySelector('[data-users-filter]');

  const { data, error } = await window.datihanSupabase.rpc('get_admin_users');

  if (error) {
    console.error('Admin users error:', error);
    status.textContent = 'Users could not be loaded. Please run supabase/admin-users.sql in Supabase.';
    page.classList.add('has-error');
    return;
  }

  const users = data || [];
  status.textContent = `${users.length} account${users.length === 1 ? '' : 's'}`;

  const render = () => {
    const selectedRole = filter.value;
    const visibleUsers = selectedRole === 'all'
      ? users
      : users.filter(user => user.role === selectedRole);

    tableBody.innerHTML = visibleUsers.map(user => `
      <tr>
        <td>
          <strong>${escapeHtml(formatName(user))}</strong>
          <span class="admin-user-id">${escapeHtml(user.id)}</span>
        </td>
        <td>${escapeHtml(user.email || '—')}</td>
        <td><span class="admin-role admin-role-${escapeHtml(user.role)}">${escapeHtml(formatRole(user.role))}</span></td>
        <td>${escapeHtml(formatDate(user.created_at))}</td>
      </tr>
    `).join('');

    emptyState.hidden = visibleUsers.length !== 0;
    tableBody.closest('table').hidden = visibleUsers.length === 0;
  };

  filter.addEventListener('change', render);
  render();
}

function formatName(user) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unnamed account';
}

function formatRole(role) {
  return {
    buyer: 'Buyer',
    shop_owner: 'Shop owner',
    admin: 'Admin'
  }[role] || role || 'Unknown';
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
