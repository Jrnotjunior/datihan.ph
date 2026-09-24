document.addEventListener('DOMContentLoaded', async () => {
  const CART_KEY = 'datihan_cart';
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

  const readCart = () => {
    try {
      const value = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  };

  const cart = readCart();
  if (!cart.length) {
    showStatus('Your cart is empty. Add an item before checkout.', 'error');
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

  const fillContact = address => {
    document.querySelector('#first-name').value = address.first_name || '';
    document.querySelector('#last-name').value = address.last_name || '';
    document.querySelector('#phone').value = address.phone || '';
  };

  const renderAddresses = addresses => {
    if (!addressEl) return;
    addressEl.innerHTML = '';
    if (!addresses.length) {
      addressEl.innerHTML = '<div class="checkout-empty-address"><strong>No saved addresses yet.</strong><p>Add a shipping address from your account before checkout.</p><a class="button button-secondary" href="../account/addresses.html">Add address</a></div>';
      return;
    }
    addresses.forEach((address, index) => {
      const label = document.createElement('label');
      label.className = `checkout-address-option${address.is_default ? ' selected' : ''}`;
      label.innerHTML = `<input type="radio" name="shipping-address" value="${String(address.id)}" ${address.is_default || (!addresses.some(a => a.is_default) && index === 0) ? 'checked' : ''}><span class="checkout-address-copy"><strong></strong><span></span><span></span><small></small></span>`;
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

  try {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user?.id) {
      window.location.replace('../auth/login.html');
      return;
    }
    const result = await supabase.from('saved_addresses').select('*').eq('user_id', data.session.user.id).order('is_default', { ascending: false }).order('created_at', { ascending: false });
    if (result.error) throw result.error;
    renderAddresses(result.data || []);
  } catch (error) {
    console.error('Checkout address error:', error);
    showStatus(`Unable to load saved addresses: ${error.message || error}`, 'error');
  }

  placeOrder?.addEventListener('click', () => {
    const selected = document.querySelector('input[name="shipping-address"]:checked');
    if (!selected) {
      showStatus('Please select a shipping address before continuing.', 'error');
      return;
    }
    showStatus('Checkout information is ready. Order placement will be enabled in the next step.', 'success');
  });
});
