document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  if (!supabase || !list) return;

  let loaded = false;

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
        .eq('user_id', userId)
        .in('status', ['shipped', 'delivered']);

      if (error) throw error;

      (orders || []).forEach(order => {
        if (!order.delivery_method && !order.tracking_number) return;

        const card = [...list.querySelectorAll('.order-card')].find(item =>
          item.querySelector('.order-number')?.textContent?.includes(`Order #${order.order_number}`)
        );
        if (!card || card.querySelector('.shipping-status-box')) return;

        const box = document.createElement('div');
        box.className = 'shipping-status-box';

        const title = document.createElement('p');
        title.className = 'shipping-status-title';
        title.textContent = order.status === 'delivered' ? 'Delivery details' : 'Shipping details';
        box.appendChild(title);

        if (order.delivery_method) {
          const method = document.createElement('p');
          method.innerHTML = `<span>Delivery method</span><strong></strong>`;
          method.querySelector('strong').textContent = order.delivery_method;
          box.appendChild(method);
        }

        if (order.tracking_number) {
          const tracking = document.createElement('p');
          tracking.innerHTML = `<span>Tracking / Reference</span><strong></strong>`;
          tracking.querySelector('strong').textContent = order.tracking_number;
          box.appendChild(tracking);
        }

        const items = card.querySelector('.order-items');
        if (items) items.before(box);
      });
    } catch (error) {
      console.error('Shipping status display error:', error);
    }
  };

  const observer = new MutationObserver(() => decorate());
  observer.observe(list, { childList: true, subtree: true });
  decorate();
});
