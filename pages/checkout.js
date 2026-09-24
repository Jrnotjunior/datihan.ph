document.addEventListener('DOMContentLoaded', async () => {
  const CART_KEY = 'datihan_cart';
  const SELECTED_KEY = 'datihan_selected_cart_items';
  const supabase = window.datihanSupabase;
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const status = document.querySelector('#checkout-status');
  const itemsEl = document.querySelector('#checkout-items');
  const subtotalEl = document.querySelector('#checkout-subtotal');
  const totalEl = document.querySelector('#checkout-total');
  const addressEl = document.querySelector('#saved-addresses');
  const placeOrder = document.querySelector('#place-order');

  const showStatus = (message, type = 'error') => {
    if (!status) return;
    status.textContent = message;
    status.className = `checkout-status ${type}`;
  };

  const showToast = (message, title = 'Success', type = 'success') => {
    let container = document.getElementById('toast-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', type === 'error' ? 'alert' : 'status');
    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">${type === 'error' ? '!' : '✓'}</div>
      <div class="toast-content">
        <div class="toast-title"></div>
        <div class="toast-message"></div>
      </div>
      <button class="toast-close" type="button" aria-label="Close notification">×</button>
    `;

    toast.querySelector('.toast-title').textContent = title;
    toast.querySelector('.toast-message').textContent = message;

    let removeTimer;
    const removeToast = () => {
      clearTimeout(removeTimer);
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 220);
    };

    toast.querySelector('.toast-close').addEventListener('click', removeToast);
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    removeTimer = setTimeout(removeToast, 4500);
  };

  const readCart = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  };

  const readSelected = () => {
    try {
      const value = JSON.parse(localStorage.getItem(SELECTED_KEY) || 'null');
      return Array.isArray(value) ? value.map(String) : null;
    } catch (_) { return null; }
  };

  const allCart = readCart();
  const savedSelection = readSelected();
  const selectedIds = savedSelection === null
    ? new Set(allCart.map(item => String(item.id)))
    : new Set(savedSelection.map(String));
  const cart = allCart.filter(item => selectedIds.has(String(item.id)));

  if (!cart.length) {
    showStatus('No items are selected for checkout. Return to your cart and select at least one item.', 'error');
    if (placeOrder) placeOrder.disabled = true;
  }

  let subtotal = 0;
  cart.forEach(item => {
    const quantity = Math.max(1, Number(item.quantity || 1));
    const price = Number(item.price || 0);
    subtotal += price * quantity;
    const row = document.createElement('div');
    row.className = 'checkout-item';
    row.innerHTML = '<div class="checkout-image">PRODUCT</div><div><p class="checkout-item-name"></p><p class="checkout-item-meta"></p></div><p class="checkout-item-price"></p>';
    row.querySelector('.checkout-item-name').textContent = item.name || 'Product';
    row.querySelector('.checkout-item-meta').textContent = `Qty ${quantity}`;
    row.querySelector('.checkout-item-price').textContent = money(price * quantity);
    itemsEl?.appendChild(row);
  });
  if (subtotalEl) subtotalEl.textContent = money(subtotal);
  if (totalEl) totalEl.textContent = money(subtotal);

  let addresses = [];
  let currentUser = null;

  const fillContact = address => {
    document.querySelector('#first-name').value = address.first_name || '';
    document.querySelector('#last-name').value = address.last_name || '';
    document.querySelector('#phone').value = address.phone || '';
    const email = document.querySelector('#email');
    if (email && !email.value) email.value = currentUser?.email || '';
  };

  const renderAddresses = list => {
    addresses = list;
    if (!addressEl) return;
    addressEl.innerHTML = '';
    if (!list.length) {
      addressEl.innerHTML = '<div class="checkout-empty-address"><strong>No saved addresses yet.</strong><p>Add a shipping address from your account before checkout.</p><a class="button button-secondary" href="../account/addresses.html">Add address</a></div>';
      return;
    }
    list.forEach((address, index) => {
      const label = document.createElement('label');
      label.className = `checkout-address-option${address.is_default ? ' selected' : ''}`;
      label.innerHTML = `<input type="radio" name="shipping-address" value="${String(address.id)}" ${address.is_default || (!list.some(a => a.is_default) && index === 0) ? 'checked' : ''}><span class="checkout-address-copy"><strong></strong><span></span><span></span><small></small></span>`;
      label.querySelector('strong').textContent = `${address.label || 'Address'}${address.is_default ? ' · Default' : ''}`;
      label.querySelectorAll('span')[1].textContent = `${address.first_name || ''} ${address.last_name || ''}`.trim();
      label.querySelectorAll('span')[2].textContent = `${address.address_line || ''}, ${address.city || ''}, ${address.province || ''} ${address.postal_code || ''}`;
      label.querySelector('small').textContent = address.phone || '';
      label.querySelector('input').addEventListener('change', () => {
        document.querySelectorAll('.checkout-address-option').forEach(el => el.classList.remove('selected'));
        label.classList.add('selected');
        fillContact(address);
      });
      addressEl.appendChild(label);
      if (label.querySelector('input').checked) fillContact(address);
    });
  };

  const createOrderNumber = () => {
    const year = new Date().getFullYear();
    const suffix = `${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 10)}`;
    return `DAT-${year}-${suffix}`;
  };

  try {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user?.id) {
      window.location.replace('../auth/login.html');
      return;
    }
    currentUser = data.session.user;
    const result = await supabase
      .from('saved_addresses')
      .select('*')
      .eq('user_id', currentUser.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false });
    if (result.error) throw result.error;
    renderAddresses(result.data || []);
  } catch (error) {
    console.error('Checkout address error:', error);
    showStatus(`Unable to load saved addresses: ${error.message || error}`, 'error');
  }

  placeOrder?.addEventListener('click', async () => {
    const selected = document.querySelector('input[name="shipping-address"]:checked');
    if (!cart.length) {
      showStatus('No items are selected for checkout. Return to your cart and select at least one item.', 'error');
      return;
    }
    if (!selected) {
      showStatus('Please select a shipping address before continuing.', 'error');
      return;
    }

    const selectedAddress = addresses.find(address => String(address.id) === String(selected.value));
    if (!selectedAddress) {
      showStatus('The selected shipping address could not be found. Please refresh and try again.', 'error');
      return;
    }

    const firstName = document.querySelector('#first-name')?.value.trim() || selectedAddress.first_name || '';
    const lastName = document.querySelector('#last-name')?.value.trim() || selectedAddress.last_name || '';
    const email = document.querySelector('#email')?.value.trim() || currentUser?.email || '';
    const phone = document.querySelector('#phone')?.value.trim() || selectedAddress.phone || '';

    if (!firstName || !lastName || !email || !phone) {
      showStatus('Please complete your contact information before placing the order.', 'error');
      return;
    }

    placeOrder.disabled = true;
    placeOrder.dataset.originalText = placeOrder.innerHTML;
    placeOrder.innerHTML = 'Placing order <span class="button-icon" aria-hidden="true">…</span>';
    showStatus('Creating your order…', 'success');

    const orderNumber = createOrderNumber();
    const shippingAddress = {
      label: selectedAddress.label || 'Address',
      first_name: firstName,
      last_name: lastName,
      phone,
      address_line: selectedAddress.address_line || '',
      city: selectedAddress.city || '',
      province: selectedAddress.province || '',
      postal_code: selectedAddress.postal_code || '',
      notes: selectedAddress.notes || ''
    };

    try {
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          order_number: orderNumber,
          user_id: currentUser.id,
          shipping_address: shippingAddress,
          subtotal,
          shipping_fee: 0,
          total: subtotal,
          status: 'pending'
        })
        .select('id, order_number')
        .single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const price = Number(item.price || 0);
        return {
          order_id: order.id,
          product_id: String(item.id),
          product_name: item.name || 'Product',
          price,
          quantity,
          subtotal: price * quantity
        };
      });

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        await supabase.from('orders').delete().eq('id', order.id);
        throw itemsError;
      }

      const selectedIdSet = new Set(cart.map(item => String(item.id)));
      const remainingCart = allCart.filter(item => !selectedIdSet.has(String(item.id)));
      localStorage.setItem(CART_KEY, JSON.stringify(remainingCart));
      localStorage.setItem(SELECTED_KEY, JSON.stringify(remainingCart.map(item => String(item.id))));
      window.dispatchEvent(new Event('datihan-cart-updated'));

      window.location.href = `order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;
    } catch (error) {
      console.error('Order placement error:', error);
      placeOrder.disabled = false;
      placeOrder.innerHTML = placeOrder.dataset.originalText || 'Place order <span class="button-icon" aria-hidden="true">→</span>';
      showStatus('');

      const message = String(error?.message || error || 'Unknown error');
      if (message.toLowerCase().includes('row-level security') || message.toLowerCase().includes('rls')) {
        showToast('Your order could not be saved because of a database permission setting. Please try again after the order policy is fixed.', 'Order not placed', 'error');
      } else {
        showToast('Something went wrong while placing your order. Please try again.', 'Order not placed', 'error');
      }
    }
  });
});
