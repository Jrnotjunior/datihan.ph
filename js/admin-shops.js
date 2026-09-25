let adminShopsStarted = false;

async function startAdminShops() {
  if (adminShopsStarted) return;

  const page = document.querySelector('[data-admin-shops]');
  if (!page) return;

  // Prefer the auth-ready event, but also verify the current session directly.
  // This prevents the page from staying on "Loading shop owners…" if the
  // auth-ready event happens before this script finishes initializing.
  let role = window.datihanAuthProfile?.role;

  if (!role) {
    const { data: sessionData, error: sessionError } = await window.datihanSupabase.auth.getSession();
    if (sessionError || !sessionData?.session?.user) return;

    const { data: profile, error: profileError } = await window.datihanSupabase
      .from('profiles')
      .select('role')
      .eq('id', sessionData.session.user.id)
      .single();

    if (profileError || !profile) return;
    role = profile.role;
    window.datihanAuthProfile = profile;
  }

  if (role !== 'admin') return;

  adminShopsStarted = true;
  await loadAdminShops();
}

document.addEventListener('datihan-auth-ready', startAdminShops);
document.addEventListener('DOMContentLoaded', startAdminShops);

async function loadAdminShops() {
  const page = document.querySelector('[data-admin-shops]');
  if (!page) return;

  const status = page.querySelector('[data-shops-status]');
  const table = page.querySelector('[data-shops-table]');
  const tableBody = page.querySelector('[data-shops-body]');
  const emptyState = page.querySelector('[data-shops-empty]');
  const errorBox = page.querySelector('[data-shops-error]');

  status.textContent = 'Loading shop owners…';
  errorBox.hidden = true;

  try {
    const { data, error } = await window.datihanSupabase.rpc('get_admin_shops');

    if (error) {
      throw error;
    }

    const shops = data || [];
    status.textContent = `${shops.length} shop owner${shops.length === 1 ? '' : 's'}`;

    if (!shops.length) {
      table.hidden = true;
      emptyState.hidden = false;
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
  } catch (error) {
    console.error('Admin shops error:', error);
    status.textContent = 'Shop owners could not be loaded.';
    errorBox.textContent = error?.message
      ? `Supabase error: ${error.message}`
      : 'Please run supabase/admin-shops.sql in Supabase, then refresh this page.';
    errorBox.hidden = false;
  }
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
