(() => {
  const supabase = window.datihanSupabase;
  const state = { products: [], soldByProduct: new Map() };
  const list = document.getElementById('inventory-list');
  const search = document.getElementById('inventory-search');
  const filter = document.getElementById('stock-filter');
  const availableCount = document.getElementById('available-count');
  const lowStockCount = document.getElementById('low-stock-count');
  const soldCount = document.getElementById('sold-count');
  const toast = document.getElementById('toast');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function showToast(message, error = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  async function getSession() {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user?.id) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  function stockState(stock) {
    const value = Number(stock || 0);
    if (value <= 0) return { key: 'out', label: 'Out of stock', className: 'out-stock' };
    if (value <= 2) return { key: 'low', label: 'Low stock', className: 'low-stock' };
    return { key: 'healthy', label: 'In stock', className: 'healthy-stock' };
  }

  function render() {
    const query = search?.value.trim().toLowerCase() || '';
    const selectedFilter = filter?.value || 'all';
    const products = state.products.filter(product => {
      const stock = stockState(product.stock);
      const matchesFilter = selectedFilter === 'all' || selectedFilter === stock.key;
      const haystack = [product.name, product.category, product.size, product.condition]
        .filter(Boolean).join(' ').toLowerCase();
      return matchesFilter && (!query || haystack.includes(query));
    });

    if (!products.length) {
      list.innerHTML = '<div class="empty-state"><h3>No inventory found.</h3><p>Try another search or stock filter.</p></div>';
      return;
    }

    list.innerHTML = products.map(product => {
      const stock = stockState(product.stock);
      const sold = state.soldByProduct.get(String(product.id)) || 0;
      return `<article class="inventory-row">
        <div class="inventory-product-main">
          <p class="eyebrow">${escapeHtml(product.category || 'Uncategorized')}</p>
          <h3>${escapeHtml(product.name)}</h3>
          <div class="inventory-product-meta">
            <span>Price: ₱${Number(product.price || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</span>
            ${product.size ? `<span>Size: ${escapeHtml(product.size)}</span>` : ''}
            ${product.condition ? `<span>${escapeHtml(product.condition)}</span>` : ''}
            <span>Sold: ${sold}</span>
          </div>
        </div>
        <div class="inventory-stock">
          <strong>${Number(product.stock || 0)}</strong>
          <span class="${stock.className}">${stock.label}</span>
        </div>
      </article>`;
    }).join('');
  }

  async function loadInventory() {
    list.innerHTML = '<p class="loading">Loading inventory...</p>';
    try {
      const session = await getSession();
      const productsResult = await supabase
        .from('products')
        .select('id, owner_id, name, price, category, size, condition, stock, is_active, created_at')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });
      if (productsResult.error) throw productsResult.error;

      state.products = productsResult.data || [];
      state.soldByProduct = new Map();

      availableCount.textContent = state.products.reduce((sum, product) => sum + Number(product.stock || 0), 0).toLocaleString('en-PH');
      lowStockCount.textContent = state.products.filter(product => Number(product.stock || 0) <= 2).length.toLocaleString('en-PH');

      const productIds = state.products.map(product => String(product.id));
      if (productIds.length) {
        const itemsResult = await supabase
          .from('order_items')
          .select('product_id, quantity, order_id')
          .in('product_id', productIds);
        if (itemsResult.error) throw itemsResult.error;

        const orderIds = [...new Set((itemsResult.data || []).map(item => item.order_id).filter(Boolean))];
        let cancelledOrders = new Set();
        if (orderIds.length) {
          const ordersResult = await supabase
            .from('orders')
            .select('id, status')
            .in('id', orderIds);
          if (ordersResult.error) throw ordersResult.error;
          cancelledOrders = new Set((ordersResult.data || [])
            .filter(order => String(order.status || '').toLowerCase() === 'cancelled')
            .map(order => String(order.id)));
        }

        let soldTotal = 0;
        (itemsResult.data || []).forEach(item => {
          if (cancelledOrders.has(String(item.order_id))) return;
          const quantity = Number(item.quantity || 0);
          const key = String(item.product_id);
          state.soldByProduct.set(key, (state.soldByProduct.get(key) || 0) + quantity);
          soldTotal += quantity;
        });
        soldCount.textContent = soldTotal.toLocaleString('en-PH');
      } else {
        soldCount.textContent = '0';
      }

      render();
    } catch (error) {
      console.error('Load inventory error:', error);
      list.innerHTML = '<div class="empty-state"><h3>We could not load your inventory.</h3><p>Please check your Supabase products and order policies, then refresh the page.</p></div>';
      showToast(error.message || 'Unable to load inventory.', true);
    }
  }

  search?.addEventListener('input', render);
  filter?.addEventListener('change', render);
  window.addEventListener('datihan-auth-ready', loadInventory);
  if (document.documentElement.classList.contains('auth-ready')) loadInventory();
})();
