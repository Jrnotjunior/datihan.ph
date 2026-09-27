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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = promotion.start_date ? new Date(`${promotion.start_date}T00:00:00`) : null;
    const end = promotion.end_date ? new Date(`${promotion.end_date}T23:59:59`) : null;

    return (!start || today >= start) && (!end || today <= end);
  };

  const appliesToProduct = (promotion, productId) => {
    const productIds = Array.isArray(promotion?.product_ids) ? promotion.product_ids : [];
    return !productIds.length || productIds.some(id => String(id) === String(productId));
  };

  // Get the shop owner from the actual products in the cart instead of
  // depending on the selected shipping-rate row. This keeps promotions
  // independent from shipping-rate configuration.
  const getCartOwnerId = async cart => {
    const productIds = [...new Set(cart.map(item => String(item.id)).filter(Boolean))];
    if (!productIds.length) return null;

    const { data, error } = await supabase
      .from('products')
      .select('id, owner_id')
      .in('id', productIds);

    if (error) throw error;

    const ownerIds = [...new Set((data || []).map(product => String(product.owner_id)).filter(Boolean))];
    return ownerIds.length === 1 ? ownerIds[0] : null;
  };

  const getApplicablePromotions = async ownerId => {
    if (!ownerId) return [];

    const { data, error } = await supabase
      .from('promotions')
      .select('id, title, discount_type, discount_value, product_ids, start_date, end_date, is_active')
      .eq('owner_id', ownerId)
      .eq('is_active', true)
      .in('discount_type', ['percentage', 'free_shipping']);

    if (error) throw error;
    return (data || []).filter(isPromotionActive);
  };

  const calculatePromotion = (promotions, cart) => {
    const result = {
      percentage: null,
      freeShipping: null,
      discount: 0,
      discountLabel: ''
    };

    // Promotions are not stacked on the same product.
    // If multiple percentage promotions match one product, use the highest one.
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

    // Any matching free-shipping promotion waives the shipping fee.
    result.freeShipping = promotions.find(p =>
      p.discount_type === 'free_shipping' && cart.some(item => appliesToProduct(p, item.id))
    ) || null;

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

  const getBaseSubtotal = () => {
    const text = document.querySelector('#checkout-subtotal')?.textContent || '0';
    return Number(text.replace(/[^0-9.-]/g, '')) || 0;
  };

  const updatePromotionDisplay = async () => {
    try {
      const cart = readSelectedCart();
      ensureDiscountRow();

      if (!cart.length) return;

      const ownerId = await getCartOwnerId(cart);
      const promotions = await getApplicablePromotions(ownerId);
      const result = calculatePromotion(promotions, cart);
      const subtotal = getBaseSubtotal();

      const shippingText = document.querySelector('#checkout-shipping')?.textContent || '';
      const normalShipping = Number(shippingText.replace(/[^0-9.-]/g, '')) || 0;
      const shippingFee = result.freeShipping ? 0 : normalShipping;

      const discountEl = document.querySelector('#checkout-discount');
      const shippingEl = document.querySelector('#checkout-shipping');
      const totalEl = document.querySelector('#checkout-total');
      const helpEl = document.querySelector('#shipping-rate-help');
      const autoRateEl = document.querySelector('#auto-shipping-rate');

      if (discountEl) {
        discountEl.textContent = result.discount > 0 ? `−${money(result.discount)}` : '—';
        discountEl.title = result.discountLabel || '';
      }

      if (shippingEl) {
        shippingEl.textContent = result.freeShipping ? 'FREE' : (normalShipping > 0 ? money(normalShipping) : shippingEl.textContent);
      }

      if (result.freeShipping && helpEl) {
        helpEl.textContent = `${result.freeShipping.title || 'Free shipping promotion'} — shipping fee waived.`;
      }

      if (result.freeShipping && autoRateEl && !autoRateEl.hidden) {
        const feeEl = autoRateEl.querySelector('span');
        if (feeEl) feeEl.textContent = 'FREE';
      }

      if (totalEl) {
        totalEl.textContent = money(Math.max(0, subtotal - result.discount + shippingFee));
      }
    } catch (error) {
      console.error('Promotion check failed:', error);
    }
  };

  // Keep the shipping RPC display consistent with a matching free-shipping promotion.
  // The database order function must still perform its own authoritative promotion
  // validation; this only prevents the checkout UI from showing a shipping charge.
  const originalRpc = supabase.rpc.bind(supabase);
  supabase.rpc = async (functionName, args, options) => {
    const result = await originalRpc(functionName, args, options);
    if (functionName !== 'get_shipping_fee' || result.error || result.data == null) return result;

    try {
      const cart = readSelectedCart();
      const ownerId = args?.p_owner_id || await getCartOwnerId(cart);
      const promotions = await getApplicablePromotions(ownerId);
      const promotionResult = calculatePromotion(promotions, cart);
      if (promotionResult.freeShipping) return { ...result, data: 0 };
    } catch (error) {
      console.error('Free shipping promotion order check failed:', error);
    }

    return result;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const refresh = () => setTimeout(updatePromotionDisplay, 300);
    refresh();

    document.addEventListener('change', event => {
      if (event.target.matches('input[name="shipping-address"]')) refresh();
    });
  });
})();
