document.addEventListener('datihan-auth-ready', loadAdminShops);

document.addEventListener('DOMContentLoaded', () => {
  if (window.datihanAuthProfile?.role === 'admin') {
    loadAdminShops();
  }
});

async function loadAdminShops() {
  const page = document.querySelector('[data-admin-shops]');
  if (!page || page.dataset.loaded === 'true') return;

  page.dataset.loaded = 'true';

  const status = page.querySelector('[data-shops-status]');
  const table = page.querySelector('[data-shops-table]');
  const tableBody = page.querySelector('[data-shops-body]');
  const emptyState = page.querySelector('[data-shops-empty]');
  const errorBox = page.querySelector('[data-shops-error]');

  const { data, error } = await window.datihanSupabase.rpc('get_admin_shops');

  if (error) {
    console.error('Admin shops error:', error);
    status.textContent = 'Shop owners could not be loaded.';
    errorBox.textContent = 'Please run supabase/admin-shops.sql in Supabase, then refresh this page.';
    errorBox.hidden = false;
    return;
  }

  const shops = data || [];
  status.textContent = `${shops.length} shop owner${shops.length === 1 ? '' : 's'}`;

  if (!shops.length) {
    emptyState.hidden = false;
    table.hidden = true;
    return;
  }

  tableBody.innerHTML = shops.map(shop => `
    <tr>
      <td>
        <strong class="admin-shop-name">${escapeHtml(shop.owner_name || 'Unnamed shop owner')}</strong>
        <span class="admin-shop-id">${escapeHtml(shop.id)}</span>
      </td>
      <td>${escapeHtml(shop.email || '—')}</td>
      <td><span class="admin-shop-count">${Number(shop.product_count || 0).toLocaleString('en-PH')}</span></td>
      <td><span class="admin-shop-count">${Number(shop.popup_count || 0).toLocaleString('en-PH')}</span></td>
      <td><span class="admin-shop-status">Active</span></td>
      <td>${escapeHtml(formatDate(shop.created_at))}</td>
    </tr>
  `).join('');

  table.hidden = false;
  emptyState.hidden = true;
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
