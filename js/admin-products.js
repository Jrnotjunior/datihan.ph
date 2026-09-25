document.addEventListener('datihan-auth-ready', loadAdminProducts);

document.addEventListener('DOMContentLoaded', () => {
  if (window.datihanAuthProfile?.role === 'admin') {
    loadAdminProducts();
  }
});

async function loadAdminProducts() {
  const page = document.querySelector('[data-admin-products]');
  if (!page || page.dataset.loaded === 'true') return;

  page.dataset.loaded = 'true';

  const status = page.querySelector('[data-products-status]');
  const table = page.querySelector('[data-products-table]');
  const tableBody = page.querySelector('[data-products-body]');
  const emptyState = page.querySelector('[data-products-empty]');
  const errorBox = page.querySelector('[data-products-error]');
  const searchInput = page.querySelector('[data-products-search]');
  const categoryFilter = page.querySelector('[data-products-category]');

  const { data, error } = await window.datihanSupabase.rpc('get_admin_products');

  if (error) {
    console.error('Admin products error:', error);
    status.textContent = 'Products could not be loaded.';
    errorBox.textContent = 'Please run supabase/admin-products.sql in Supabase, then refresh this page.';
    errorBox.hidden = false;
    return;
  }

  const products = data || [];
  status.textContent = `${products.length} product${products.length === 1 ? '' : 's'}`;

  const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort();
  categoryFilter.innerHTML = '<option value="">All categories</option>' + categories
    .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join('');

  function render() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;

    const filtered = products.filter(product => {
      const text = [product.name, product.description, product.category, product.size, product.condition, product.owner_email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return (!query || text.includes(query)) && (!category || product.category === category);
    });

    if (!filtered.length) {
      table.hidden = true;
      emptyState.hidden = false;
      emptyState.textContent = products.length ? 'No products match your search.' : 'No products have been listed yet.';
      return;
    }

    tableBody.innerHTML = filtered.map(product => `
      <tr>
        <td>
          <strong class="admin-product-name">${escapeHtml(product.name || 'Unnamed product')}</strong>
          <span class="admin-product-id">${escapeHtml(product.id)}</span>
        </td>
        <td>${escapeHtml(product.owner_email || '—')}</td>
        <td>${escapeHtml(product.category || '—')}</td>
        <td>${peso(product.price)}</td>
        <td>${Number(product.stock || 0).toLocaleString('en-PH')}</td>
        <td><span class="admin-product-status ${product.is_active ? '' : 'inactive'}">${product.is_active ? 'Active' : 'Hidden'}</span></td>
        <td>${escapeHtml(formatDate(product.created_at))}</td>
      </tr>
    `).join('');

    table.hidden = false;
    emptyState.hidden = true;
  }

  searchInput.addEventListener('input', render);
  categoryFilter.addEventListener('change', render);
  render();
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

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
