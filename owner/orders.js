document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  const list = document.getElementById('orders-list');
  const filter = document.getElementById('order-filter');
  const search = document.getElementById('order-search');
  const toast = document.getElementById('toast');
  const detailModal = document.getElementById('order-modal');
  const detailContent = document.getElementById('order-detail');

  const state = { orders: [] };
  const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered', 'cancelled'];
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  function showToast(message, error = false) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.toggle('error', error);
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function formatDate(value) {
    if (!value) return 'Date unavailable';
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function statusLabel(value) {
    return String(value || 'pending').replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function getShipping(order) {
    const address = order.shipping_address || {};
    const firstName = address.first_name || address.firstName || '';
    const lastName = address.last_name || address.lastName || '';
    const phone = address.phone || address.contact_number || address.contactNumber || 'No phone number';
    const line = [address.address_line || address.address || address.street || address.street_address, address.city, address.province || address.state, address.postal_code || address.postalCode || address.zip].filter(Boolean).join(', ');
    return { name: `${firstName} ${lastName}`.trim() || address.name || 'Customer', phone, line: line || 'No shipping address' };
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
      return `<article class="order-card"><div class="order-card-top"><div><p class="eyebrow">${escapeHtml(formatDate(order.created_at))}</p><h2>${escapeHtml(order.order_number || `Order ${order.id}`)}</h2></div><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div><div class="order-summary-row"><div><span class="muted-label">Customer</span><strong>${escapeHtml(shipping.name)}</strong></div><div><span class="muted-label">Items</span><strong>${totalItems}</strong></div><div><span class="muted-label">Total</span><strong>${money(total)}</strong></div></div><div class="order-actions"><button class="button button-secondary button-small" type="button" data-action="view" data-id="${escapeHtml(order.id)}">View details</button><label class="status-control"><span>Update status</span><select data-action="status" data-id="${escapeHtml(order.id)}" aria-label="Update order status">${statuses.map(option => `<option value="${option}" ${option === status ? 'selected' : ''}>${statusLabel(option)}</option>`).join('')}</select></label></div></article>`;
    }).join('');
  }

  function closeOrder() {
    detailModal?.classList.remove('is-open');
    detailModal?.setAttribute('aria-hidden', 'true');
  }

  function openOrder(order) {
    const shipping = getShipping(order);
    const items = order.order_items || [];
    const subtotal = Number(order.subtotal || 0);
    const shippingFee = Number(order.shipping_fee || 0);
    const total = Number(order.total ?? subtotal + shippingFee);
    const status = String(order.status || 'pending');

    detailContent.innerHTML = `<div class="modal-header"><div><p class="eyebrow">ORDER DETAILS</p><h2>${escapeHtml(order.order_number || `Order ${order.id}`)}</h2><p class="modal-date">${escapeHtml(formatDate(order.created_at))}</p></div><button class="modal-close" id="close-order-modal-inner" type="button" aria-label="Close">×</button></div><div class="modal-status-row"><div><span class="muted-label">Order status</span><span class="status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span></div><label class="modal-status-control"><span>Change status</span><select id="modal-status-select">${statuses.map(option => `<option value="${option}" ${option === status ? 'selected' : ''}>${statusLabel(option)}</option>`).join('')}</select></label></div><div class="detail-grid"><div><span class="muted-label">Customer</span><strong>${escapeHtml(shipping.name)}</strong></div><div><span class="muted-label">Contact number</span><strong>${escapeHtml(shipping.phone)}</strong></div><div class="detail-full"><span class="muted-label">Delivery address</span><strong>${escapeHtml(shipping.line)}</strong></div></div><div class="detail-section"><div class="detail-section-heading"><h3>Order items</h3><span>${items.length} product${items.length === 1 ? '' : 's'}</span></div>${items.length ? items.map(item => { const quantity = Number(item.quantity || 1); const price = Number(item.price || 0); const itemSubtotal = Number(item.subtotal ?? price * quantity); return `<div class="detail-item"><div><strong>${escapeHtml(item.product_name || 'Product')}</strong><span>₱${price.toLocaleString('en-PH')} × ${quantity}</span></div><strong>${money(itemSubtotal)}</strong></div>`; }).join('') : '<p class="muted-text">No order items found.</p>'}</div><div class="detail-totals"><div><span>Subtotal</span><strong>${money(subtotal)}</strong></div><div><span>Shipping</span><strong>${shippingFee ? money(shippingFee) : 'To be calculated'}</strong></div><div class="detail-grand-total"><span>Total</span><strong>${money(total)}</strong></div></div>`;

    detailModal.classList.add('is-open');
    detailModal.setAttribute('aria-hidden', 'false');
    document.getElementById('close-order-modal-inner')?.addEventListener('click', closeOrder);
    document.getElementById('modal-status-select')?.addEventListener('change', event => updateStatus(order.id, event.target.value, event.target, true));
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
      const ordersResult = await supabase.from('orders').select('id, order_number, user_id, shipping_address, subtotal, shipping_fee, total, status, created_at, updated_at').order('created_at', { ascending: false });
      if (ordersResult.error) throw ordersResult.error;
      const orders = ordersResult.data || [];
      if (!orders.length) { state.orders = []; render(); return; }
      const orderIds = orders.map(order => order.id);
      const itemsResult = await supabase.from('order_items').select('id, order_id, product_id, product_name, price, quantity, subtotal, created_at').in('order_id', orderIds);
      if (itemsResult.error) throw itemsResult.error;
      const itemsByOrder = new Map();
      (itemsResult.data || []).forEach(item => { const key = String(item.order_id); if (!itemsByOrder.has(key)) itemsByOrder.set(key, []); itemsByOrder.get(key).push(item); });
      state.orders = orders.map(order => ({ ...order, order_items: itemsByOrder.get(String(order.id)) || [] }));
      render();
    } catch (error) {
      console.error('Load owner orders error:', error);
      list.innerHTML = '<div class="empty-state"><h2>We could not load your orders.</h2><p class="owner-error-message"></p></div>';
      const message = error?.message || 'Unable to load orders.';
      list.querySelector('.owner-error-message').textContent = message;
      showToast(message, true);
    }
  }

  async function updateStatus(orderId, nextStatus, select, fromModal = false) {
    const order = state.orders.find(item => String(item.id) === String(orderId));
    if (!order || order.status === nextStatus) return;
    const previous = order.status || 'pending';
    select.disabled = true;
    try {
      const { data, error } = await supabase.from('orders').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', orderId).select('id, status').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('The order status could not be saved. Your owner account may not have permission to update orders yet.');
      order.status = data.status || nextStatus;
      showToast(`Order ${order.order_number || ''} updated to ${statusLabel(order.status)}.`);
      if (fromModal) openOrder(order); else render();
    } catch (error) {
      console.error('Update order status error:', error);
      select.value = previous;
      showToast(error?.message || 'Unable to update the order status.', true);
    } finally { select.disabled = false; }
  }

  filter?.addEventListener('change', render);
  search?.addEventListener('input', render);
  list?.addEventListener('click', event => { const button = event.target.closest('[data-action="view"]'); if (!button) return; const order = state.orders.find(item => String(item.id) === String(button.dataset.id)); if (order) openOrder(order); });
  list?.addEventListener('change', event => { const select = event.target.closest('[data-action="status"]'); if (select) updateStatus(select.dataset.id, select.value, select); });
  detailModal?.addEventListener('click', event => { if (event.target === detailModal) closeOrder(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeOrder(); });
  window.addEventListener('datihan-auth-ready', loadOrders);
  if (document.documentElement.classList.contains('auth-ready')) loadOrders();
});
