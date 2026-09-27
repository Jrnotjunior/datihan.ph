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

  const appliesToCart = (promotion, cart) => {
    const productIds = Array.isArray(promotion?.product_ids) ? promotion.product_ids : [];
    if (!productIds.length) return true;
    const cartIds = new Set(cart.map(item => String(item.id)));
    return productIds.some(id => cartIds.has(String(id)));
  };

  const getFreeShippingPromotion = async ownerId => {
    if (!ownerId) return null;
    const cart = readSelectedCart();
    if (!cart.length) return null;

    const { data, error } = await supabase
      .from('promotions')
      .select('id, title, discount_type, product_ids, start_date, end_date, is_active')
      .eq('owner_id', ownerId)
      .eq('discount_type', 'free_shipping')
      .eq('is_active', true);

    if (error) throw error;
    return (data || []).find(promotion => isPromotionActive(promotion) && appliesToCart(promotion, cart)) || null;
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

  const updateFreeShippingDisplay = async () => {
    try {
      const ownerId = await getSelectedRateOwnerId();
      const promotion = await getFreeShippingPromotion(ownerId);
      const shippingEl = document.querySelector('#checkout-shipping');
      const totalEl = document.querySelector('#checkout-total');
      const subtotalEl = document.querySelector('#checkout-subtotal');
      const helpEl = document.querySelector('#shipping-rate-help');
      const autoRateEl = document.querySelector('#auto-shipping-rate');

      if (!shippingEl || !totalEl || !subtotalEl) return;

      if (promotion) {
        const subtotalText = subtotalEl.textContent.replace(/[^0-9.-]/g, '');
        const subtotal = Number(subtotalText) || 0;
        shippingEl.textContent = 'FREE';
        totalEl.textContent = money(subtotal);
        if (helpEl) helpEl.textContent = `${promotion.title || 'Free shipping promotion'} — shipping fee waived.`;
        if (autoRateEl && !autoRateEl.hidden) {
          const feeEl = autoRateEl.querySelector('span');
          if (feeEl) feeEl.textContent = 'FREE';
        }
      }
    } catch (error) {
      console.error('Free shipping promotion check failed:', error);
    }
  };

  const originalRpc = supabase.rpc.bind(supabase);
  supabase.rpc = async (functionName, args, options) => {
    const result = await originalRpc(functionName, args, options);
    if (functionName !== 'get_shipping_fee' || result.error || !result.data) return result;

    try {
      const promotion = await getFreeShippingPromotion(args?.p_owner_id);
      if (promotion) return { ...result, data: 0 };
    } catch (error) {
      console.error('Free shipping promotion order check failed:', error);
    }
    return result;
  };

  document.addEventListener('DOMContentLoaded', () => {
    const refresh = () => setTimeout(updateFreeShippingDisplay, 100);
    refresh();
    document.addEventListener('change', event => {
      if (event.target.matches('input[name="shipping-address"]')) refresh();
    });
  });
})();
