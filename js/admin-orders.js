window.addEventListener('datihan-auth-ready', loadAdminOrders);

document.addEventListener('DOMContentLoaded', () => {
  if (window.datihanAuthProfile?.role === 'admin') {
    loadAdminOrders();
  }
});

async function loadAdminOrders() {
  const page = document.querySelector('[data-admin-orders]');
  if (!page || page.dataset.loaded === 'true') return;

  page.dataset.loaded = 'true';

  const status = page.querySelector('[data-orders-status]');
  const table = page.querySelector('[data-orders-table]');
  const tableBody = page.querySelector('[data-orders-body]');
  const emptyState = page.querySelector('[data-orders-empty]');
  const errorBox = page.querySelector('[data-orders-error]');

  const { data, error } =
    await window.datihanSupabase.rpc('get_admin_orders');

  if (error) {
    console.error('Admin orders error:', error);

    status.textContent = 'Orders could not be loaded.';
    errorBox.textContent =
      'Please run supabase/admin-orders.sql in Supabase, then refresh this page.';
    errorBox.hidden = false;

    return;
  }

  const orders = data || [];

  status.textContent =
    `${orders.length} order${orders.length === 1 ? '' : 's'}`;

  if (!orders.length) {
    table.hidden = true;
    emptyState.hidden = false;
    emptyState.textContent = 'No orders have been placed yet.';
    return;
  }

  tableBody.innerHTML = orders.map(order => `
    <tr>
      <td>
        <strong class="admin-order-number">
          ${escapeHtml(order.order_number || '—')}
        </strong>
        <span class="admin-order-id">
          ${escapeHtml(order.id || '')}
        </span>
      </td>

      <td>
        ${escapeHtml(order.user_email || order.email || '—')}
      </td>

      <td>
        ${peso(order.subtotal)}
      </td>

      <td>
        ${peso(order.shipping_fee)}
      </td>

      <td>
        <strong>${peso(order.total)}</strong>
      </td>

      <td>
        <span class="admin-order-status ${statusClass(order.status)}">
          ${escapeHtml(formatStatus(order.status))}
        </span>
      </td>

      <td>
        ${escapeHtml(formatDate(order.created_at))}
      </td>
    </tr>
  `).join('');

  table.hidden = false;
  emptyState.hidden = true;
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

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

function formatStatus(status) {
  if (!status) return 'Unknown';

  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function statusClass(status) {
  return String(status || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
