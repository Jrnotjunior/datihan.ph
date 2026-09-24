document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  const list = document.getElementById('orders-list');
  const filter = document.getElementById('order-filter');
  const search = document.getElementById('order-search');
  const toast = document.getElementById('toast');
  const detailModal = document.getElementById('order-modal');
  const detailContent = document.getElementById('order-detail');
  const closeModal = document.getElementById('close-order-modal');

  const state = { orders: [] };
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'];

  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  function showToast(message, error = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function statusLabel(value) {
    return String(value || 'pending')
      .replaceAll('_', ' ')
      .replace(/\b\w/g, char => char.toUpperCase());
  }

  function getShipping(order) {
    const address = order.shipping_address || {};
    return {
      name: `${address.first_name || ''} ${address.last_name || ''}`.trim() || 'Customer',
      phone: address.phone || 'No phone number',
      line: [address.address_line, address.city, address.province, address.postal_code]
        .filter(Boolean)
        .join(', ') || 'No shipping address'
    };
  }

  function render() {
    const query = search?.value.trim().toLowerCase() || '';
    const selectedStatus = filter?.value || 'all';

    const visible = state.orders.filter(order => {
      const shipping = getShipping(order);
      const status = String(order.status || 'pending');
      const haystack = `${order.order_number || ''} ${shipping.name} ${shipping.phone}`.toLowerCase();
      return (selectedStatus === 'all' || status === selectedStatus) && (!query || haystack.includes(query));
    });

    if (!visible.length) {
      list.innerHTML = '<div class="empty-state"><h2>No orders found.</h2><p>Customer orders will appear here when they are available to your shop.</p></div>';
      return;
    }

    list.innerHTML = visible.map(order => {
      const shipping = getShipping(order);
      const items = order.order_items || [];
      const totalItems = items.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
      const total = Number(order.total ?? order.subtotal ?? 0);
      const status = String(order.status || 'pending');

      return `
        <article class="order-card">
          <div class="order-card-top">
            <div>
              <p class="eyebrow">${escapeHtml(formatDate(order.created_at))}</p>
              <h2>${escapeHtml(order.order_number || `Order ${order.id}`)}</h2>
            </div>
            <span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
          </div>
          <div class="order-summary-row">
            <div><span class="muted-label">Customer</span><strong>${escapeHtml(shipping.name)}</strong></div>
            <div><span class="muted-label">Items</span><strong>${totalItems}</strong></div>
            <div><span class="muted-label">Total</span><strong>${money(total)}</strong></div>
          </div>
          <div class="order-actions">
            <button class="button button-secondary button-small" type="button" data-action="view" data-id="${escapeHtml(order.id)}">View details</button>
            <label class="status-control">
              <span>Update status</span>
              <select data-action="status" data-id="${escapeHtml(order.id)}" aria-label="Update order status">
                ${statuses.map(option => `<option value="${option}" ${option === status ? 'selected' : ''}>${statusLabel(option)}</option>`).join('')}
              </select>
            </label>
          </div>
        </article>
      `;
    }).join('');
  }

  function closeOrder() {
    detailModal?.classList.remove('is-open');
    detailModal?.setAttribute('aria-hidden', 'true');
  }

  function openOrder(order) {
    const shipping = getShipping(order);
    const items = order.order_items || [];

    detailContent.innerHTML = `
      <div class="modal-header">
        <div>
          <p class="eyebrow">ORDER DETAILS</p>
          <h2>${escapeHtml(order.order_number || `Order ${order.id}`)}</h2>
        </div>
        <button class="modal-close" id="close-order-modal-inner" type="button" aria-label="Close">×</button>
      </div>
      <div class="detail-grid">
        <div><span class="muted-label">Customer</span><strong>${escapeHtml(shipping.name)}</strong></div>
        <div><span class="muted-label">Contact</span><strong>${escapeHtml(shipping.phone)}</strong></div>
        <div class="detail-full"><span class="muted-label">Shipping address</span><strong>${escapeHtml(shipping.line)}</strong></div>
      </div>
      <div class="detail-section">
        <h3>Items</h3>
        ${items.map(item => `
          <div class="detail-item">
            <div><strong>${escapeHtml(item.product_name || 'Product')}</strong><span>Qty ${Number(item.quantity || 1)}</span></div>
            <strong>${money(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 1))}</strong>
          </div>
        `).join('')}
      </div>
      <div class="detail-total"><span>Total</span><strong>${money(order.total ?? order.subtotal)}</strong></div>
    `;

    detailModal.classList.add('is-open');
    detailModal.setAttribute('aria-hidden', 'false');
    document.getElementById('close-order-modal-inner')?.addEventListener('click', closeOrder);
  }

  async function getSession() {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user?.id) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  async function loadOrders() {
    list.innerHTML = '<p class="loading">Loading your orders...</p>';

    try {
      await getSession();

      // The production database has no public.products table.
      // Orders and their line items are the source of truth for owner order management.
      const ordersResult = await supabase
        .from('orders')
        .select('id, order_number, user_id, shipping_address, subtotal, shipping_fee, total, status, created_at, updated_at')
        .order('created_at', { ascending: false });

      if (ordersResult.error) throw ordersResult.error;

      const orders = ordersResult.data || [];
      if (!orders.length) {
        state.orders = [];
        render();
        return;
      }

      const orderIds = orders.map(order => order.id);
      const itemsResult = await supabase
        .from('order_items')
        .select('id, order_id, product_id, product_name, price, quantity, subtotal, created_at')
        .in('order_id', orderIds);

      if (itemsResult.error) throw itemsResult.error;

      const itemsByOrder = new Map();
      (itemsResult.data || []).forEach(item => {
        const key = String(item.order_id);
        if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
        itemsByOrder.get(key).push(item);
      });

      state.orders = orders.map(order => ({
        ...order,
        order_items: itemsByOrder.get(String(order.id)) || []
      }));

      render();
    } catch (error) {
      console.error('Load owner orders error:', error);
      list.innerHTML = '<div class="empty-state"><h2>We could not load your orders.</h2><p class="owner-error-message"></p></div>';
      const message = error?.message || 'Unable to load orders.';
      list.querySelector('.owner-error-message').textContent = message;
      showToast(message, true);
    }
  }

  async function updateStatus(orderId, nextStatus, select) {
    const order = state.orders.find(item => String(item.id) === String(orderId));
    if (!order || order.status === nextStatus) return;

    const previous = order.status || 'pending';
    select.disabled = true;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId);

      if (error) throw error;

      order.status = nextStatus;
      showToast(`Order ${order.order_number || ''} updated to ${statusLabel(nextStatus)}.`);
      render();
    } catch (error) {
      console.error('Update order status error:', error);
      select.value = previous;
      showToast(error?.message || 'Unable to update the order status.', true);
    } finally {
      select.disabled = false;
    }
  }

  filter?.addEventListener('change', render);
  search?.addEventListener('input', render);

  list?.addEventListener('click', event => {
    const button = event.target.closest('[data-action="view"]');
    if (!button) return;
    const order = state.orders.find(item => String(item.id) === String(button.dataset.id));
    if (order) openOrder(order);
  });

  list?.addEventListener('change', event => {
    const select = event.target.closest('[data-action="status"]');
    if (!select) return;
    updateStatus(select.dataset.id, select.value, select);
  });

  closeModal?.addEventListener('click', closeOrder);
  detailModal?.addEventListener('click', event => {
    if (event.target === detailModal) closeOrder();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeOrder();
  });

  window.addEventListener('datihan-auth-ready', loadOrders);
  if (document.documentElement.classList.contains('auth-ready')) loadOrders();
});
