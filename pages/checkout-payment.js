document.addEventListener('DOMContentLoaded', () => {
  const supabase = window.datihanSupabase;
  const placeOrder = document.getElementById('place-order');
  const orderSummary = document.querySelector('.order-summary');
  const shippingRateEl = document.getElementById('shipping-rate');
  const totalEl = document.getElementById('checkout-total');
  const status = document.getElementById('checkout-status');

  if (!supabase || !placeOrder || !orderSummary) return;

  const style = document.createElement('style');
  style.textContent = `
    .checkout-payment-section { margin: 24px 0; padding: 20px; border: 1px solid rgba(92, 62, 42, .22); border-radius: 18px; background: rgba(255, 250, 246, .7); }
    .checkout-payment-heading h2 { margin: 4px 0 6px; }
    .checkout-payment-heading p:not(.eyebrow) { margin: 0 0 16px; color: #765c4a; }
    .checkout-payment-option { display: flex; gap: 12px; align-items: flex-start; padding: 14px; border: 1px solid rgba(92, 62, 42, .25); border-radius: 14px; cursor: pointer; }
    .checkout-payment-option input { margin-top: 3px; accent-color: #2a211b; }
    .checkout-payment-copy { display: grid; gap: 4px; }
    .checkout-payment-copy span { color: #765c4a; font-size: .9rem; line-height: 1.45; }
    .checkout-gcash-panel { margin-top: 14px; }
    .checkout-gcash-status { color: #765c4a; font-size: .9rem; margin-bottom: 12px; }
    .checkout-gcash-content { display: grid; grid-template-columns: 170px 1fr; gap: 18px; align-items: center; padding-top: 4px; }
    .checkout-gcash-qr-wrap { display: flex; align-items: center; justify-content: center; min-height: 170px; padding: 10px; background: #fff; border: 1px solid rgba(92, 62, 42, .18); border-radius: 14px; }
    .checkout-gcash-qr { display: block; width: 150px; height: 150px; object-fit: contain; }
    .checkout-gcash-details { display: grid; gap: 8px; }
    .checkout-gcash-details strong { font-size: 1rem; }
    .checkout-gcash-details p { margin: 0; color: #765c4a; font-size: .9rem; line-height: 1.45; }
    .checkout-gcash-amount { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: 10px; background: rgba(92, 62, 42, .06); }
    .checkout-paid-check { display: flex; gap: 8px; align-items: flex-start; font-size: .9rem; cursor: pointer; }
    .checkout-paid-check input { margin-top: 3px; accent-color: #2a211b; }
    .checkout-gcash-details small { color: #8a705e; line-height: 1.4; }
    @media (max-width: 640px) {
      .checkout-gcash-content { grid-template-columns: 1fr; }
      .checkout-gcash-qr-wrap { width: min(100%, 190px); justify-self: center; }
    }
  `;
  document.head.appendChild(style);

  let paymentConfirmed = false;
  let activeOwnerId = null;
  let activeQrUrl = null;
  let loadingQr = false;
  let resolvedOwnerId = null;

  const paymentSection = document.createElement('section');
  paymentSection.className = 'checkout-payment-section';
  paymentSection.innerHTML = `
    <div class="checkout-payment-heading">
      <div>
        <p class="eyebrow">PAYMENT</p>
        <h2>Choose how to pay</h2>
        <p>Pay the shop directly through its currently active GCash QR.</p>
      </div>
    </div>
    <label class="checkout-payment-option selected">
      <input type="radio" name="payment-method" value="gcash" checked>
      <span class="checkout-payment-copy">
        <strong>GCash</strong>
        <span>Scan the shop's active GCash QR and send the exact order total.</span>
      </span>
    </label>
    <div class="checkout-gcash-panel">
      <div class="checkout-gcash-status">Loading the shop's active GCash QR…</div>
      <div class="checkout-gcash-content" hidden>
        <div class="checkout-gcash-qr-wrap">
          <img class="checkout-gcash-qr" alt="Shop GCash payment QR">
        </div>
        <div class="checkout-gcash-details">
          <strong>Pay via GCash</strong>
          <p>Open GCash, scan this QR, and send the exact amount shown below.</p>
          <div class="checkout-gcash-amount"><span>Amount to send</span><strong class="checkout-gcash-total">₱0</strong></div>
          <label class="checkout-paid-check">
            <input type="checkbox" class="checkout-paid-input">
            <span>I have sent the payment via GCash.</span>
          </label>
          <small>The shop owner will verify your payment manually before fulfilling the order.</small>
        </div>
      </div>
    </div>
  `;

  const placeOrderParent = placeOrder.parentElement;
  placeOrderParent?.insertBefore(paymentSection, placeOrder);

  const paymentStatus = paymentSection.querySelector('.checkout-gcash-status');
  const paymentContent = paymentSection.querySelector('.checkout-gcash-content');
  const qrImage = paymentSection.querySelector('.checkout-gcash-qr');
  const amountEl = paymentSection.querySelector('.checkout-gcash-total');
  const paidInput = paymentSection.querySelector('.checkout-paid-input');

  const showCheckoutStatus = message => {
    if (!status) return;
    status.textContent = message;
    status.className = 'checkout-status error';
    status.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const currentOwnerId = () => resolvedOwnerId;

  const setPaymentState = confirmed => {
    paymentConfirmed = confirmed;
    if (paidInput) paidInput.checked = confirmed;
  };

  const loadActiveQr = async ownerId => {
    if (!ownerId) {
      activeOwnerId = null;
      activeQrUrl = null;
      paymentContent.hidden = true;
      paymentStatus.textContent = 'Select a shipping address to load the shop payment QR.';
      setPaymentState(false);
      return;
    }

    if (loadingQr && activeOwnerId === ownerId) return;
    if (activeOwnerId === ownerId && activeQrUrl) return;

    loadingQr = true;
    activeOwnerId = ownerId;
    activeQrUrl = null;
    setPaymentState(false);
    paymentContent.hidden = true;
    paymentStatus.textContent = 'Loading the shop\'s active GCash QR…';

    try {
      const { data, error } = await supabase
        .from('payment_qr_codes')
        .select('public_url')
        .eq('owner_id', ownerId)
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data?.public_url) {
        paymentStatus.textContent = 'This shop has not activated a GCash QR yet. Please contact the shop owner.';
        return;
      }

      activeQrUrl = data.public_url;
      qrImage.src = activeQrUrl;
      paymentContent.hidden = false;
      paymentStatus.textContent = 'Current shop GCash QR';
      amountEl.textContent = totalEl?.textContent || '₱0';
    } catch (error) {
      console.error('Unable to load active GCash QR:', error);
      paymentStatus.textContent = 'Unable to load the shop\'s GCash QR. Please refresh and try again.';
    } finally {
      loadingQr = false;
    }
  };

  const resetPayment = () => {
    resolvedOwnerId = null;
    activeOwnerId = null;
    activeQrUrl = null;
    setPaymentState(false);
    paymentContent.hidden = true;
    paymentStatus.textContent = 'Select a shipping address to load the shop payment QR.';
  };

  paidInput?.addEventListener('change', () => {
    setPaymentState(paidInput.checked);
  });

  shippingRateEl?.addEventListener('change', () => {
    resetPayment();
  });

  // Run before checkout.js's normal click handler. The customer must first see
  // the current QR and confirm that payment was sent; the original order flow
  // then continues unchanged on the next click.
  placeOrder.addEventListener('click', async event => {
    if (paymentConfirmed) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const ownerId = currentOwnerId();
    if (!ownerId) {
      showCheckoutStatus('Please select a shipping address before choosing GCash.');
      return;
    }

    if (!activeQrUrl) {
      await loadActiveQr(ownerId);
      if (!activeQrUrl) {
        showCheckoutStatus('This shop does not currently have an active GCash QR, so the order cannot continue yet.');
      }
      return;
    }

    if (!paidInput?.checked) {
      showCheckoutStatus('After sending the payment through GCash, tick “I have sent the payment via GCash.” before placing your order.');
      paidInput?.focus();
    }
  }, true);

  const updateAmount = () => {
    if (amountEl) amountEl.textContent = totalEl?.textContent || '₱0';
  };
  if (totalEl) new MutationObserver(updateAmount).observe(totalEl, { childList: true, characterData: true, subtree: true });

  const resolveOwner = async () => {
    const rateId = shippingRateEl?.value;
    if (!rateId) return null;
    const { data, error } = await supabase.from('shipping_rates').select('owner_id').eq('id', rateId).maybeSingle();
    if (error) {
      console.error('Unable to resolve shipping owner:', error);
      return null;
    }
    return data?.owner_id || null;
  };

  let lastRateId = shippingRateEl?.value || '';
  setInterval(async () => {
    const nextRateId = shippingRateEl?.value || '';
    if (nextRateId === lastRateId) return;
    lastRateId = nextRateId;
    resetPayment();
    resolvedOwnerId = await resolveOwner();
    await loadActiveQr(resolvedOwnerId);
  }, 250);

  setTimeout(async () => {
    resolvedOwnerId = await resolveOwner();
    await loadActiveQr(resolvedOwnerId);
  }, 400);
});
