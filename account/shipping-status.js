document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  if (!supabase || !list) return;

  let loaded = false;
  const statusSteps = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    shipped: 'Shipped',
    delivered: 'Delivered'
  };

  const decorate = async () => {
    if (loaded || !list.querySelector('.order-card')) return;
    loaded = true;

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const userId = sessionData.session?.user?.id;
      if (!userId) return;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('order_number, status, delivery_method, tracking_number')
        .eq('user_id', userId);

      if (error) throw error;

      (orders || []).forEach(order => {
        const card = [...list.querySelectorAll('.order-card')].find(item =>
          item.querySelector('.order-number')?.textContent?.includes(`Order #${order.order_number}`)
        );
        if (!card || card.querySelector('.order-progress') || !statusSteps.includes(order.status)) return;

        const currentIndex = statusSteps.indexOf(order.status);
        const progress = document.createElement('div');
        progress.className = 'order-progress';

        const title = document.createElement('p');
        title.className = 'order-progress-title';
        title.textContent = 'Order progress';
        progress.appendChild(title);

        const track = document.createElement('div');
        track.className = 'order-progress-track';
        track.setAttribute('aria-label', `Order status: ${statusLabels[order.status]}`);

        statusSteps.forEach((step, index) => {
          const item = document.createElement('div');
          item.className = 'order-progress-step';
          if (index < currentIndex) item.classList.add('is-complete');
          if (index === currentIndex) item.classList.add('is-current');

          const dot = document.createElement('span');
          dot.className = 'order-progress-dot';
          dot.setAttribute('aria-hidden', 'true');

          const label = document.createElement('span');
          label.className = 'order-progress-label';
          label.textContent = statusLabels[step];

          item.append(dot, label);
          track.appendChild(item);
        });

        progress.appendChild(track);

        const shippingBox = document.createElement('div');
        shippingBox.className = 'shipping-status-box';

        const shippingTitle = document.createElement('p');
        shippingTitle.className = 'shipping-status-title';
        shippingTitle.textContent = order.status === 'delivered' ? 'Delivery details' : 'Shipping details';
        shippingBox.appendChild(shippingTitle);

        if (order.delivery_method) {
          const method = document.createElement('p');
          method.innerHTML = '<span>Delivery method</span><strong></strong>';
          method.querySelector('strong').textContent = order.delivery_method;
          shippingBox.appendChild(method);
        }

        if (order.tracking_number) {
          const tracking = document.createElement('p');
          tracking.innerHTML = '<span>Tracking / Reference</span><strong></strong>';
          tracking.querySelector('strong').textContent = order.tracking_number;
          shippingBox.appendChild(tracking);
        }

        const items = card.querySelector('.order-items');
        if (items) {
          items.before(progress);
          if (order.delivery_method || order.tracking_number) items.before(shippingBox);
        }
      });
    } catch (error) {
      console.error('Order progress display error:', error);
    }
  };

  const observer = new MutationObserver(() => decorate());
  observer.observe(list, { childList: true, subtree: true });
  decorate();
});
