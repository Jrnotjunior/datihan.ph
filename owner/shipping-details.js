document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  if (!supabase) return;

  const previousStatus = new WeakMap();
  let shippingModal = null;
  let activeOrderId = null;

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function closeModal(select, restore = true) {
    if (shippingModal) {
      shippingModal.remove();
      shippingModal = null;
    }
    if (restore && select) {
      select.value = previousStatus.get(select) || 'preparing';
    }
    if (select) select.disabled = false;
  }

  function showShippingModal(order, select) {
    closeModal(null, false);
    previousStatus.set(select, String(order.status || 'preparing'));

    const backdrop = document.createElement('div');
    backdrop.className = 'shipping-backdrop';
    backdrop.innerHTML = `
      <div class="shipping-modal" role="dialog" aria-modal="true" aria-labelledby="shipping-modal-title">
        <div class="shipping-modal-header">
          <div>
            <p class="eyebrow">SHIPPING DETAILS</p>
            <h2 id="shipping-modal-title">Mark order as shipped</h2>
            <p>Order ${escapeHtml(order.order_number || '')} is ready to leave the shop. Add the delivery information the customer will need.</p>
          </div>
          <button class="shipping-close" type="button" aria-label="Close">×</button>
        </div>

        <label class="shipping-field">
          <span>Delivery method / Courier <b>*</b></span>
          <input id="shipping-method" type="text" maxlength="100" placeholder="e.g. J&T Express, Lalamove, Shop delivery" autocomplete="off">
        </label>

        <label class="shipping-field">
          <span>Tracking / Reference number <em>Optional</em></span>
          <input id="shipping-tracking" type="text" maxlength="120" placeholder="Enter tracking number if available" autocomplete="off">
        </label>

        <p class="shipping-help">The customer will see these details after the order is marked as shipped. A tracking number is optional for shop delivery or couriers without tracking.</p>
        <p class="shipping-error" id="shipping-error" role="alert"></p>

        <div class="shipping-actions">
          <button class="button button-secondary" id="shipping-cancel" type="button">Cancel</button>
          <button class="button" id="shipping-save" type="button">Mark as Shipped</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    shippingModal = backdrop;
    select.disabled = true;

    const methodInput = backdrop.querySelector('#shipping-method');
    const trackingInput = backdrop.querySelector('#shipping-tracking');
    const errorBox = backdrop.querySelector('#shipping-error');
    const saveButton = backdrop.querySelector('#shipping-save');

    const cancel = () => closeModal(select, true);
    backdrop.querySelector('.shipping-close')?.addEventListener('click', cancel);
    backdrop.querySelector('#shipping-cancel')?.addEventListener('click', cancel);
    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) cancel();
    });

    const save = async () => {
      const deliveryMethod = methodInput.value.trim();
      const trackingNumber = trackingInput.value.trim();
      if (!deliveryMethod) {
        errorBox.textContent = 'Please enter the delivery method or courier.';
        methodInput.focus();
        return;
      }

      saveButton.disabled = true;
      saveButton.textContent = 'Saving...';
      errorBox.textContent = '';

      try {
        const { data, error } = await supabase
          .from('orders')
          .update({
            status: 'shipped',
            delivery_method: deliveryMethod,
            tracking_number: trackingNumber || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id)
          .eq('status', 'preparing')
          .select('id, status, delivery_method, tracking_number')
          .maybeSingle();

        if (error) throw error;
        if (!data) throw new Error('This order is no longer in Preparing status. Refresh the page and try again.');

        shippingModal = null;
        backdrop.remove();
        window.location.reload();
      } catch (error) {
        console.error('Save shipping details error:', error);
        errorBox.textContent = error?.message || 'Unable to mark the order as shipped.';
        saveButton.disabled = false;
        saveButton.textContent = 'Mark as Shipped';
      }
    };

    saveButton.addEventListener('click', save);
    backdrop.addEventListener('keydown', event => {
      if (event.key === 'Escape') cancel();
      if (event.key === 'Enter' && event.target.tagName === 'INPUT') save();
    });

    methodInput.focus();
  }

  document.addEventListener('click', event => {
    const viewButton = event.target.closest('[data-action="view"]');
    if (viewButton?.dataset.id) activeOrderId = viewButton.dataset.id;
  }, true);

  document.addEventListener('change', async event => {
    const select = event.target.closest('select[data-action="status"], #modal-status-select');
    if (!select || select.value !== 'shipped') return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const orderId = select.dataset.id || activeOrderId;
    if (!orderId) {
      select.value = 'preparing';
      return;
    }

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, delivery_method, tracking_number')
        .eq('id', orderId)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error('Order not found.');

      if (String(data.status) !== 'preparing') {
        select.value = data.status || 'preparing';
        return;
      }

      showShippingModal(data, select);
    } catch (error) {
      console.error('Load shipping details error:', error);
      select.value = 'preparing';
      window.alert(error?.message || 'Unable to prepare shipping details.');
    }
  }, true);
});
