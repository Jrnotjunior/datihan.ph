document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const params = new URLSearchParams(window.location.search);
  const orderNumber = params.get('order');
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };

  if (!supabase || !orderNumber) {
    setText('#confirmation-message', 'We could not find the order details for this confirmation.');
    setText('#order-number', orderNumber ? `Order #${orderNumber}` : 'Order details unavailable');
    return;
  }

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session?.user?.id) {
      window.location.replace('../auth/login.html');
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, shipping_address, subtotal, shipping_fee, total, status, created_at')
      .eq('order_number', orderNumber)
      .eq('user_id', sessionData.session.user.id)
      .single();

    if (orderError) throw orderError;

    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_name, price, quantity, subtotal')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    setText('#order-number', `Order #${order.order_number}`);
    setText('#confirmation-message', 'Your order has been placed successfully. We saved the details to your account.');
    setText('#confirmation-shipping', order.shipping_fee > 0 ? money(order.shipping_fee) : 'To be calculated');
    setText('#confirmation-total', money(order.total));
    setText('#confirmation-status', order.status.charAt(0).toUpperCase() + order.status.slice(1));

    const address = order.shipping_address || {};
    const addressText = [
      `${address.first_name || ''} ${address.last_name || ''}`.trim(),
      address.address_line,
      [address.city, address.province, address.postal_code].filter(Boolean).join(', ')
    ].filter(Boolean).join(' · ');
    setText('#confirmation-address', addressText || 'Address saved with order');

    const itemsEl = document.querySelector('#confirmation-items');
    if (itemsEl) {
      itemsEl.innerHTML = '';
      (items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'confirmation-row';
        row.innerHTML = '<span></span><strong></strong>';
        row.querySelector('span').textContent = `${item.product_name} × ${item.quantity}`;
        row.querySelector('strong').textContent = money(item.subtotal);
        itemsEl.appendChild(row);
      });
    }
  } catch (error) {
    console.error('Order confirmation error:', error);
    setText('#confirmation-message', 'We could not load this order right now. Please check My Orders.');
    setText('#order-number', `Order #${orderNumber}`);
  }
});
