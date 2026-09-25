document.addEventListener('DOMContentLoaded', async () => {
  const CART_KEY = 'datihan_cart';
  const SELECTED_KEY = 'datihan_selected_cart_items';
  const supabase = window.datihanSupabase;
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const status = document.querySelector('#checkout-status');
  const itemsEl = document.querySelector('#checkout-items');
  const subtotalEl = document.querySelector('#checkout-subtotal');
  const shippingEl = document.querySelector('#checkout-shipping');
  const totalEl = document.querySelector('#checkout-total');
  const addressEl = document.querySelector('#saved-addresses');
  const shippingRateEl = document.querySelector('#shipping-rate');
  const shippingRateHelp = document.querySelector('#shipping-rate-help');
  const autoShippingRateEl = document.querySelector('#auto-shipping-rate');
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
      <div class="toast-content"><div class="toast-title"></div><div class="toast-message"></div></div>
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

  if (!cart.length) {
    showStatus('No items are selected for checkout. Return to your cart and select at least one item.', 'error');
    if (placeOrder) placeOrder.disabled = true;
  }

  let addresses = [];
  let shippingRates = [];
  let currentUser = null;

  const normalise = value => String(value || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/city of |municipality of /g, '')
    .replace(/\s+city$|\s+municipality$/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const METRO_MANILA_CITIES = new Set([
    'caloocan', 'las pinas', 'makati', 'malabon', 'mandaluyong', 'manila',
    'marikina', 'muntinlupa', 'navotas', 'paranaque', 'pasay', 'pasig',
    'quezon city', 'san juan', 'taguig', 'valenzuela'
  ]);

  const VISAYAS_PROVINCES = new Set([
    'aklan', 'antique', 'capiz', 'guimaras', 'iloilo', 'negros occidental',
    'negros oriental', 'cebu', 'bohol', 'siquijor', 'biliran', 'eastern samar',
    'leyte', 'northern samar', 'samar', 'western samar', 'southern leyte',
    'romblon', 'central visayas', 'western visayas', 'eastern visayas'
  ]);

  const MINDANAO_PROVINCES = new Set([
    'zamboanga del norte', 'zamboanga del sur', 'zamboanga sibugay', 'basilan',
    'bukidnon', 'camiguin', 'lanao del norte', 'lanao del sur', 'maguindanao',
    'maguindanao del norte', 'maguindanao del sur', 'sulu', 'tawi tawi',
    'davao de oro', 'davao del norte', 'davao del sur', 'davao occidental',
    'davao oriental', 'cotabato', 'north cotabato', 'south cotabato', 'sarangani',
    'sultan kudarat', 'agusan del norte', 'agusan del sur', 'dinagat islands',
    'surigao del norte', 'surigao del sur', 'misamis occidental', 'misamis oriental'
  ]);

  const detectZone = address => {
    const city = normalise(address?.city);
    const province = normalise(address?.province);

    if (
      ['metro manila', 'metropolitan manila', 'ncr', 'national capital region'].includes(province) ||
      METRO_MANILA_CITIES.has(city)
    ) return 'Metro Manila';

    if (VISAYAS_PROVINCES.has(province)) return 'Visayas';
    if (MINDANAO_PROVINCES.has(province)) return 'Mindanao';
    return 'Luzon (Outside Metro Manila)';
  };

  const rateZone = areaName => {
    const name = normalise(areaName);
    if (/^metro manila$|^metropolitan manila$|^national capital region$|^ncr$/.test(name)) return 'Metro Manila';
    if (/visayas/.test(name)) return 'Visayas';
    if (/mindanao/.test(name)) return 'Mindanao';
    if (/luzon|outside metro manila|outside ncr|nationwide/.test(name)) return 'Luzon (Outside Metro Manila)';
    return name;
  };

  const findRateForAddress = address => {
    const zone = detectZone(address);
    const match = shippingRates.find(rate => rateZone(rate.area_name) === zone);
    return { zone, match };
  };

  const updateTotals = () => {
    const selectedAddress = document.querySelector('input[name="shipping-address"]:checked');
    const address = addresses.find(item => String(item.id) === String(selectedAddress?.value));
    const result = address ? findRateForAddress(address) : { zone: '', match: null };
    const rate = result.match;
    const shippingFee = Number(rate?.shipping_fee || 0);

    if (shippingRateEl) {
      shippingRateEl.value = rate ? String(rate.id) : '';
      shippingRateEl.hidden = true;
      shippingRateEl.disabled = true;
    }

    if (autoShippingRateEl) {
      autoShippingRateEl.hidden = false;
      autoShippingRateEl.innerHTML = '';
      const zoneEl = document.createElement('strong');
      const feeEl = document.createElement('span');
      zoneEl.textContent = result.zone || 'Shipping';
      feeEl.textContent = rate ? money(shippingFee) : 'No shipping rate available';
      autoShippingRateEl.append(zoneEl, feeEl);
    }

    if (shippingEl) shippingEl.textContent = rate ? money(shippingFee) : 'No shipping rate available';
    if (totalEl) totalEl.textContent = money(subtotal + shippingFee);
    if (shippingRateHelp) {
      shippingRateHelp.textContent = rate
        ? 'Shipping fee is automatically calculated from your delivery address.'
        : 'The shop does not currently have a shipping rate for this delivery area.';
    }
    if (placeOrder) placeOrder.disabled = !cart.length || !rate;
  };

  const renderShippingRates = list => {
    shippingRates = list;
    if (!shippingRateEl) return;
    shippingRateEl.innerHTML = '<option value="">Select a delivery area</option>';
    list.forEach(rate => {
      const option = document.createElement('option');
      option.value = String(rate.id);
      option.textContent = `${rate.area_name} — ${money(rate.shipping_fee)}`;
      shippingRateEl.appendChild(option);
    });

    if (!list.length) {
      shippingRateHelp.textContent = 'No active shipping rates are available. The shop owner needs to add one before you can place an order.';
      showStatus('No active shipping rates are available yet. Please try again after the shop owner adds a delivery rate.', 'error');
    }
    updateTotals();
  };

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
      const input = label.querySelector('input');
      label.querySelector('strong').textContent = `${address.label || 'Address'}${address.is_default ? ' · Default' : ''}`;
      label.querySelectorAll('span')[1].textContent = `${address.first_name || ''} ${address.last_name || ''}`.trim();
      const barangay = address.barangay ? `${address.barangay}, ` : '';
      label.querySelectorAll('span')[2].textContent = `${address.address_line || ''}, ${barangay}${address.city || ''}, ${address.province || ''} ${address.postal_code || ''}`;
      label.querySelector('small').textContent = address.phone || '';
      input.addEventListener('change', () => {
        document.querySelectorAll('.checkout-address-option').forEach(el => el.classList.remove('selected'));
        label.classList.add('selected');
        fillContact(address);
        updateTotals();
      });
      addressEl.appendChild(label);
      if (input.checked) fillContact(address);
    });
    updateTotals();
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

    const [addressResult, shippingResult] = await Promise.all([
      supabase.from('saved_addresses').select('*').eq('user_id', currentUser.id).order('is_default', { ascending: false }).order('created_at', { ascending: false }),
      supabase.from('shipping_rates').select('id, owner_id, area_name, shipping_fee').eq('is_active', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    ]);

    if (addressResult.error) throw addressResult.error;
    if (shippingResult.error) throw shippingResult.error;

    renderAddresses(addressResult.data || []);
    renderShippingRates(shippingResult.data || []);
  } catch (error) {
    console.error('Checkout setup error:', error);
    showStatus(`Unable to load checkout information: ${error.message || error}`, 'error');
    if (placeOrder) placeOrder.disabled = true;
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
    const { match: rate } = findRateForAddress(selectedAddress);
    if (!selectedAddress) {
      showStatus('The selected shipping address could not be found. Please refresh and try again.', 'error');
      return;
    }
    if (!rate) {
      showStatus('No shipping rate is configured for this delivery area.', 'error');
      return;
    }
    if (!rate.owner_id) {
      showStatus('The selected shipping rate is missing its shop owner. Please refresh and try again.', 'error');
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

    const shippingAddress = {
      label: selectedAddress.label || 'Address',
      first_name: firstName,
      last_name: lastName,
      phone,
      address_line: selectedAddress.address_line || '',
      barangay: selectedAddress.barangay || '',
      city: selectedAddress.city || '',
      province: selectedAddress.province || '',
      postal_code: selectedAddress.postal_code || '',
      notes: selectedAddress.notes || ''
    };

    try {
      const { data: authoritativeShippingFee, error: shippingFeeError } = await supabase.rpc('get_shipping_fee', {
        p_owner_id: rate.owner_id,
        p_shipping_address: shippingAddress
      });

      if (shippingFeeError) throw shippingFeeError;

      const shippingFee = Number(authoritativeShippingFee);
      if (!Number.isFinite(shippingFee) || shippingFee < 0) throw new Error('The calculated shipping fee is invalid.');

      const orderTotal = subtotal + shippingFee;
      const orderNumber = createOrderNumber();

      const { data: order, error: orderError } = await supabase.from('orders').insert({
        order_number: orderNumber,
        user_id: currentUser.id,
        shipping_address: shippingAddress,
        shipping_rate_id: rate.id,
        subtotal,
        shipping_fee: shippingFee,
        total: orderTotal,
        status: 'pending'
      }).select('id, order_number').single();

      if (orderError) throw orderError;

      const orderItems = cart.map(item => {
        const quantity = Math.max(1, Number(item.quantity || 1));
        const price = Number(item.price || 0);
        return { order_id: order.id, product_id: String(item.id), product_name: item.name || 'Product', price, quantity, subtotal: price * quantity };
      });

      const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
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
        showToast('Your order could not be saved because of a database permission setting. Please check the order policies.', 'Order not placed', 'error');
      } else if (message.toLowerCase().includes('shipping')) {
        showToast('The shipping fee could not be verified for this address. Please check the selected address and try again.', 'Shipping not available', 'error');
      } else {
        showToast('Something went wrong while placing the order. Please try again.', 'Order not placed', 'error');
      }
    }
  });
});
