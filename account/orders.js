document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  const empty = document.querySelector('#orders-empty');
  const note = document.querySelector('#orders-note');
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;

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

    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id, order_number, subtotal, shipping_fee, total, status, created_at')
      .eq('user_id', sessionData.session.user.id)
      .order('created_at', { ascending: false });

    if (ordersError) throw ordersError;

    if (!orders?.length) {
      if (list) list.innerHTML = '';
      if (empty) empty.hidden = false;
      return;
    }

    if (empty) empty.hidden = true;
    if (list) list.innerHTML = '';

    for (const order of orders) {
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('product_name, price, quantity, subtotal')
        .eq('order_id', order.id)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

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
          <a class="view-order">View order →</a>
        </div>
      `;

      card.querySelector('.order-number').textContent = `Order #${order.order_number}`;
      card.querySelector('.order-date').textContent = date;
      card.querySelector('.order-status').textContent = statusText;
      card.querySelector('.order-total strong').textContent = money(order.total);
      card.querySelector('.view-order').href = `../pages/order-confirmation.html?order=${encodeURIComponent(order.order_number)}`;

      const itemsEl = card.querySelector('.order-items');
      (items || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item';
        row.innerHTML = '<div class="order-image">PRODUCT</div><div><p class="order-item-name"></p><p class="order-item-meta"></p></div><p class="order-item-price"></p>';
        row.querySelector('.order-item-name').textContent = item.product_name;
        row.querySelector('.order-item-meta').textContent = `Qty ${item.quantity}`;
        row.querySelector('.order-item-price').textContent = money(item.subtotal);
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
