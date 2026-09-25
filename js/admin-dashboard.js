window.addEventListener('datihan-auth-ready', loadAdminDashboard);

document.addEventListener('DOMContentLoaded', () => {
  if (window.datihanAuthProfile?.role === 'admin') {
    loadAdminDashboard();
  }
});

async function loadAdminDashboard() {
  const dashboard = document.querySelector('[data-admin-dashboard]');
  if (!dashboard || dashboard.dataset.loaded === 'true') return;

  dashboard.dataset.loaded = 'true';

  const { data, error } = await window.datihanSupabase.rpc('get_admin_dashboard_stats');

  if (error) {
    console.error('Admin dashboard stats error:', error);
    dashboard.querySelector('[data-dashboard-status]').textContent =
      'Dashboard data could not be loaded.';
    dashboard.classList.add('has-error');
    return;
  }

  const stats = data || {};

  dashboard.querySelector('[data-stat="total_users"]').textContent = stats.total_users ?? '0';
  dashboard.querySelector('[data-stat="buyers"]').textContent = stats.buyers ?? '0';
  dashboard.querySelector('[data-stat="shop_owners"]').textContent = stats.shop_owners ?? '0';
  dashboard.querySelector('[data-stat="admins"]').textContent = stats.admins ?? '0';
  dashboard.querySelector('[data-stat="total_products"]').textContent = stats.total_products ?? '0';
  dashboard.querySelector('[data-stat="total_orders"]').textContent = stats.total_orders ?? '0';
  dashboard.querySelector('[data-stat="pending_orders"]').textContent = stats.pending_orders ?? '0';
  dashboard.querySelector('[data-dashboard-status]').textContent = 'Live platform data';

  await loadRecentAdminOrders(dashboard);
}

async function loadRecentAdminOrders(dashboard) {
  const container = dashboard.querySelector('#recent-admin-orders');
  if (!container) return;

  const { data, error } = await window.datihanSupabase.rpc('get_admin_orders');

  if (error) {
    console.error('Recent admin orders error:', error);
    container.innerHTML = '<p class="admin-order-buyer">Recent orders could not be loaded.</p>';
    return;
  }

  const orders = (data || []).slice(0, 3);

  if (!orders.length) {
    container.innerHTML = '<p><strong>No recent orders.</strong><br><span class="admin-order-buyer">New customer orders will appear here.</span></p>';
    return;
  }

  container.innerHTML = `
    <div class="admin-order-list">
      ${orders.map(order => `
        <a class="admin-order-row" href="orders.html">
          <div class="admin-order-main">
            <strong class="admin-order-number">${escapeHtml(order.order_number || '—')}</strong>
            <span class="admin-order-id">${escapeHtml(order.id || '')}</span>
          </div>
          <span class="admin-order-buyer">${escapeHtml(order.user_email || order.email || '—')}</span>
          <span class="admin-order-total">${peso(order.total)}</span>
          <span class="admin-order-status ${statusClass(order.status)}">${escapeHtml(formatStatus(order.status))}</span>
          <span class="admin-order-date">${escapeHtml(formatDate(order.created_at))}</span>
        </a>
      `).join('')}
    </div>
  `;
}

function peso(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
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

function formatStatus(status) {
  if (!status) return 'Unknown';

  return String(status)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusClass(status) {
  return `status-${String(status || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
