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
      'Dashboard data could not be loaded. Please check the Supabase admin dashboard function.';
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
}
