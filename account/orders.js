document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  const empty = document.querySelector('#orders-empty');
  const note = document.querySelector('#orders-note');
  const money = value => `₱${Number(value || 0).toLocaleString('en-PH')}`;

  const productImages = product => {
    if (!product) return [];
    if (Array.isArray(product.image_urls) && product.image_urls.length) {
      return product.image_urls.filter(Boolean);
    }
    return product.image_url ? [product.image_url] : [];
  };

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

    const orderIds = orders.map(order => order.id);
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, order_id, product_id, product_name, price, quantity, subtotal, created_at')
      .in('order_id', orderIds)
      .order('created_at', { ascending: true });

    if (itemsError) throw itemsError;

    const productIds = [...new Set((items || [])
      .map(item => item.product_id)
      .filter(Boolean)
      .map(String))];

    const productsById = new Map();
    if (productIds.length) {
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, image_url, image_urls')
        .in('id', productIds);

      if (productsError) throw productsError;
      (products || []).forEach(product => {
        productsById.set(String(product.id), product);
      });
    }

    const itemsByOrder = new Map();
    (items || []).forEach(item => {
      const key = String(item.order_id);
      if (!itemsByOrder.has(key)) itemsByOrder.set(key, []);
      itemsByOrder.get(key).push(item);
    });

    for (const order of orders) {
      const orderItems = itemsByOrder.get(String(order.id)) || [];
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
      orderItems.forEach(item => {
        const row = document.createElement('div');
        row.className = 'order-item';

        const product = productsById.get(String(item.product_id));
        const images = productImages(product);
        const imageEl = document.createElement('div');
        imageEl.className = 'order-image';

        if (images[0]) {
          const image = document.createElement('img');
          image.src = images[0];
          image.alt = item.product_name || 'Product image';
          image.loading = 'lazy';
          image.decoding = 'async';
          imageEl.appendChild(image);
        } else {
          imageEl.textContent = 'PRODUCT';
        }

        const details = document.createElement('div');
        const name = document.createElement('p');
        name.className = 'order-item-name';
        name.textContent = item.product_name;
        const meta = document.createElement('p');
        meta.className = 'order-item-meta';
        meta.textContent = `Qty ${item.quantity}`;
        details.append(name, meta);

        const price = document.createElement('p');
        price.className = 'order-item-price';
        price.textContent = money(item.subtotal);

        row.append(imageEl, details, price);
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
