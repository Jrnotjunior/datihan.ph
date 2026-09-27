(() => {
  const supabase = window.datihanSupabase;
  const cartStore = window.datihanCartStore;
  if (!supabase || !cartStore) return;

  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  const readSelectedCart = () => {
    const allCart = Array.isArray(cartStore.read()) ? cartStore.read() : [];
    const savedSelection = cartStore.readSelected();
    if (savedSelection === null) return allCart;
    const selectedIds = new Set(Array.isArray(savedSelection) ? savedSelection.map(String) : []);
    return allCart.filter(item => selectedIds.has(String(item.id)));
  };

  const isPromotionActive = promotion => {
    if (!promotion?.is_active) return false;
    const now = new Date();
    const start = promotion.start_date ? new Date(`${promotion.start_date}T00:00:00`) : null;
    const end = promotion.end_date ? new Date(`${promotion.end_date}T23:59:59`) : null;
    return (!start || now >= start) && (!end || now <= end);
  };

  const appliesToProduct = (promotion, productId) => {
    const productIds = Array.isArray(promotion?.product_ids) ? promotion.product_ids : [];
    return !productIds.length || productIds.some(id => String(id) === String(productId));
  };

  const getApplicablePromotions = async ownerId => {
    if (!ownerId) return [];
    const cart = readSelectedCart();
    if (!cart.length) return [];

    const { data, error } = await supabase
      .from('promotions')
      .select('id, title, discount_type, discount_value, product_ids, start_date, end_date, is_active')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .in('discount_type', ['percentage', 'free_shipping']);

    if (error) throw error;
    return (data || []).filter(promotion => isPromotionActive(promotion));
  };

  const calculatePromotion = (promotions, cart) => {
    const result = {
      percentage: null,
      freeShipping: null,
      discount: 0,
      discountLabel: ''
    };

    // One percentage promotion is applied per item; promotions are not stacked.
    // If several percentage promotions match an item, use the largest percentage.
    cart.forEach(item => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.price || 0);
      const matching = promotions
        .filter(p => p.discount_type === 'percentage' && appliesToProduct(p, item.id))
        .filter(p => Number(p.discount_value) > 0 && Number(p.discount_value) <= 100)
        .sort((a, b) => Number(b.discount_value) - Number(a.discount_value));

      const promotion = matching[0];
      if (!promotion) return;

      const lineDiscount = price * quantity * (Number(promotion.discount_value) / 100);
      result.discount += lineDiscount;
      if (!result.percentage || Number(promotion.discount_value) > Number(result.percentage.discount_value)) {
        result.percentage = promotion;
      }
    });

    const freeShipping = promotions.find(p =>
      p.discount_type === 'free_shipping' && cart.some(item => appliesToProduct(p, item.id))
    );
    result.freeShipping = freeShipping || null;
    if (result.percentage) {
      result.discountLabel = result.percentage.title
        ? `${result.percentage.title} (${Number(result.percentage.discount_value)}% off)`
        : `${Number(result.percentage.discount_value)}% off`;
    }
    return result;
  };

  const ensureDiscountRow = () => {
    const summaryTotal = document.querySelector('.summary-total');
    if (!summaryTotal || document.querySelector('#checkout-discount-row')) return;
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.id = 'checkout-discount-row';
    row.innerHTML = '<span>Discount</span><strong id="checkout-discount">—</strong>';
    summaryTotal.parentNode.insertBefore(row, summaryTotal);
  };

  const getSelectedRateOwnerId = async () => {
    const rateId = document.querySelector('#shipping-rate')?.value;
    if (!rateId) return null;
    const { data, error } = await supabase
      .from('shipping_rates')
      .select('owner_id')
      .eq('id', rateId)
      .maybeSingle();
    if (error) throw error;
    return data?.owner_id || null;
  };

  const getBaseSubtotal = () => {
    const text = document.querySelector('#checkout-subtotal')?.textContent || '0';
    return Number(text.replace(/[^0-9.-]/g, '')) || 0;
  };

  const updatePromotionDisplay = async () => {
    try {
      ensureDiscountRow();
      const ownerId = await getSelectedRateOwnerId();
      const cart = readSelectedCart();
      const promotions = await getApplicablePromotions(ownerId);
      const result = calculatePromotion(promotions, cart);
      const subtotal = getBaseSubtotal();
      const shippingText = document.querySelector('#checkout-shipping')?.textContent || '';
      const normalShipping = Number(shippingText.replace(/[^0-9.-]/g, '')) || 0;
      const discountEl = document.querySelector('#checkout-discount');
      const shippingEl = document.querySelector('#checkout-shipping');
      const totalEl = document.querySelector('#checkout-total');
      const helpEl = document.querySelector('#shipping-rate-help');
      const autoRateEl = document.querySelector('#auto-shipping-rate');

      if (discountEl) {
        discountEl.textContent = result.discount > 0 ? `−${money(result.discount)}` : '—';
        discountEl.title = result.discountLabel || '';
      }

      const shippingFee = result.freeShipping ? 0 : normalShipping;
      if (result.freeShipping && shippingEl) shippingEl.textContent = 'FREE';
      if (result.freeShipping && helpEl) {
        helpEl.textContent = `${result.freeShipping.title || 'Free shipping promotion'} — shipping fee waived.`;
      }
      if (result.freeShipping && autoRateEl && !autoRateEl.hidden) {
        const feeEl = autoRateEl.querySelector('span');
        if (feeEl) feeEl.textContent = 'FREE';
      }

      if (totalEl) totalEl.textContent = money(Math.max(0, subtotal - result.discount + shippingFee));
    } catch (error) {
      console.error('Promotion check failed:', error);
    }
  };

  const originalRpc = supabase.rpc.bind(supabase);
  supabase.rpc = async (functionName, args, options) => {
    const result = await originalRpc(functionName, args, options);
    if (functionName !== 'get_shipping_fee' || result.error || result.data == null) return result;

    try {
      const ownerId = args?.p_owner_id;
      const cart = readSelectedCart();
      const promotions = await getApplicablePromotions(ownerId);
      const promotionResult = calculatePromotion(promotions, cart);
      if (promotionResult.freeShipping) return { ...result, data: 0 };
    } catch (error) {
      console.error('Free shipping promotion order check failed:', error);
    }
    return result;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const refresh = () => setTimeout(updatePromotionDisplay, 150);
    refresh();
    document.addEventListener('change', event => {
      if (event.target.matches('input[name="shipping-address"]')) refresh();
    });
  });
})();
