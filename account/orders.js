document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  const empty = document.querySelector('#orders-empty');
  const note = document.querySelector('#orders-note');
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  const productImages = product => {
    if (!product) return [];
    if (Array.isArray(product.image_urls) && product.image_urls.length) {
      return product.image_urls.filter(Boolean);
    }
    return product.image_url ? [product.image_url] : [];
  };

  const createCancelModal = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-backdrop confirm-backdrop';
    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="modal confirm-modal" role="dialog" aria-modal="true" aria-labelledby="cancel-modal-title">
        <div class="confirm-icon" aria-hidden="true">!</div>
        <p class="eyebrow">CONFIRM STATUS CHANGE</p>
        <h2 id="cancel-modal-title">Change order status?</h2>
        <p id="cancel-modal-message" class="confirm-message"></p>
        <div class="confirm-actions">
          <button class="button button-secondary" id="cancel-modal-cancel" type="button">Cancel</button>
          <button class="button" id="cancel-modal-confirm" type="button">Confirm Cancelled</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  };

  const cancelModal = createCancelModal();
  const keepButton = cancelModal.querySelector('#cancel-modal-cancel');
  const confirmButton = cancelModal.querySelector('#cancel-modal-confirm');
  const confirmMessage = cancelModal.querySelector('#cancel-modal-message');
  let activeOrder = null;
  let activeCard = null;

  const closeCancelModal = () => {
    cancelModal.hidden = true;
    cancelModal.classList.remove('is-open');
    cancelModal.setAttribute('aria-hidden', 'true');
    activeOrder = null;
    activeCard = null;
  };

  keepButton.addEventListener('click', closeCancelModal);
  cancelModal.addEventListener('click', event => {
    if (event.target === cancelModal) closeCancelModal();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !cancelModal.hidden) closeCancelModal();
  });

  if (!supabase) {
    if (list) list.innerHTML = '<p class="orders-loading">Unable to connect to your orders right now.</p>';
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user?.id) {
      window.location.replace('../auth/login.html');
      return;
    }

    const currentUserId = sessionData.session.user.id;

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, subtotal, shipping_fee, total, status, created_at')
      .eq('user_id', currentUserId)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    if (!orders?.length) {
      if (list) list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    if (list) list.innerHTML = '';

    const orderIds = orders.map(order => order.id);
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, price, quantity, subtotal, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    const productIds = [...new Set((items || [])
      .map(item => item.product_id)
      .filter(Boolean)
      .map(String))];

    const productsById = new Map();
    if (productIds.length) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, image_url, image_urls')
        .in('id', productIds);

      if (productsError) throw productsError;
      (products || []).forEach(product => {
        productsById.set(String(product.id), product);
      });
    }

    const itemsByOrder = new Map();
    (items || []).forEach(item => {
      const key = String(item.order_id);
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key).push(item);
    });

    confirmButton.addEventListener('click', async () => {
      if (!activeOrder || !activeCard) return;

      confirmButton.disabled = true;
      confirmButton.textContent = 'Cancelling…';

      try {
        const { data: result, error: cancelError } = await supabase.rpc(
          'cancel_order_and_restore_stock',
          {
            p_order_id: activeOrder.id,
            p_user_id: currentUserId
          }
        );

        if (cancelError) throw cancelError;

        if (!result?.success) {
          throw new Error(result?.message || 'This order could not be cancelled.');
        }

        activeOrder.status = 'cancelled';
        const statusEl = activeCard.querySelector('.order-status');
        if (statusEl) statusEl.textContent = 'Cancelled';

        const cancelButton = activeCard.querySelector('.cancel-order');
        if (cancelButton) cancelButton.remove();

        const cancelledOrderNumber = activeOrder.order_number;
        closeCancelModal();
        if (note) note.textContent = `Order #${cancelledOrderNumber} has been cancelled. The purchased quantity has been returned to stock.`;
      } catch (error) {
        console.error('Order cancellation error:', error);
        if (note) note.textContent = `Unable to cancel the order: ${error.message || error}`;
        confirmButton.disabled = false;
        confirmButton.textContent = 'Confirm Cancelled';
      }
    });

    for (const order of orders) {
      const orderItems = itemsByOrder.get(String(order.id)) || [];
      const card = document.createElement('article');
      card.className = 'order-card';
      const date = new Date(order.created_at).toLocaleDateString('en-PH', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      const statusText = order.status.charAt(0).toUpperCase() + order.status.slice(1);

      card.innerHTML = `
        <div class="order-card-header">
          <div><p class="order-number"></p><p class="order-date"></p></div>
          <span class="order-status"></span>
        </div>
        <div class="order-items"></div>
        <div class="order-card-footer">
          <p class="order-total">Total <strong></strong></p>
          <div class="order-actions">
            <a class="view-order">View order →</a>
            ${order.status === 'pending' ? '<button type="button" class="cancel-order">Cancel Order</button>' : ''}
          </div>
        </div>
      `;

      card.querySelector('.order-number').textContent = `Order #${order.order_number}`;
      card.querySelector('.order-date').textContent = date;
      card.querySelector('.order-status').textContent = statusText;
      card.querySelector('.order-total strong').textContent = money(order.total);
      card.querySelector('.view-order').href = `../pages/order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;

      const cancelButton = card.querySelector('.cancel-order');
      if (cancelButton) {
        cancelButton.addEventListener('click', () => {
          activeOrder = order;
          activeCard = card;
          confirmButton.disabled = false;
          confirmButton.textContent = 'Confirm Cancelled';
          confirmMessage.textContent = `Are you sure you want to cancel order ${order.order_number || ''}? This changes the order status.`;
          cancelModal.hidden = false;
          cancelModal.classList.add('is-open');
          cancelModal.setAttribute('aria-hidden', 'false');
          requestAnimationFrame(() => keepButton.focus());
        });
      }

      const itemsEl = card.querySelector('.order-items');
      orderItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item';

        const product = productsById.get(String(item.product_id));
        const images = productImages(product);
        const imageEl = document.createElement('div');
        imageEl.className = 'order-image';

        if (images[0]) {
          const image = document.createElement('img');
          image.src = images[0];
          image.alt = item.product_name || 'Product image';
          image.loading = 'lazy';
          image.decoding = 'async';
          imageEl.appendChild(image);
        } else {
          imageEl.textContent = 'PRODUCT';
        }

        const details = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'order-item-name';
        name.textContent = item.product_name;
        const meta = document.createElement('p');
        meta.className = 'order-item-meta';
        meta.textContent = `Qty ${item.quantity}`;
        details.append(name, meta);

        const price = document.createElement('p');
        price.className = 'order-item-price';
        price.textContent = money(item.subtotal);

        row.append(imageEl, details, price);
        itemsEl.appendChild(row);
      });

      list?.appendChild(card);
    }
  } catch (error) {
    console.error('Orders page error:', error);
    if (list) list.innerHTML = '<p class="orders-loading">Unable to load your orders. Please refresh the page and try again.</p>';
    if (note) note.textContent = `Order loading error: ${error.message || error}`;
  }
});
