document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  const main = document.querySelector('.orders-main');
  if (!supabase || !list || !main) return;

  const statusSteps = ['pending', 'confirmed', 'preparing', 'shipped', 'delivered'];
  const statusLabels = {
    pending: 'Pending',
    confirmed: 'Confirmed',
    preparing: 'Preparing',
    shipped: 'Shipped',
    delivered: 'Delivered'
  };

  const icons = {
    pending: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v5l3 2"></path></svg>',
    confirmed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"></path></svg>',
    preparing: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 8-4 8 4-8 4-8-4Z"></path><path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z"></path><path d="M12 12v8"></path></svg>',
    shipped: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3z"></path><path d="M14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="1.7"></circle><circle cx="18" cy="18" r="1.7"></circle></svg>',
    delivered: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9.5 21v-6h5v6"></path></svg>'
  };

  const ensureSummary = () => {
    let summary = document.querySelector('#orders-progress-summary');
    if (summary) return summary;

    summary = document.createElement('section');
    summary.id = 'orders-progress-summary';
    summary.className = 'orders-progress-summary';
    summary.setAttribute('aria-label', 'Order progress summary');
    summary.innerHTML = `
      <div class="orders-progress-heading">
        <div>
          <p class="eyebrow">ORDER PROGRESS</p>
          <p class="orders-progress-subtitle">Your current orders by status.</p>
        </div>
        <button type="button" class="orders-progress-reset" id="orders-progress-reset">All orders</button>
      </div>
      <div class="orders-progress-track" role="list"></div>
    `;

    const header = main.querySelector('.orders-header');
    header?.after(summary);
    return summary;
  };

  const updateSummary = orders => {
    const summary = ensureSummary();
    const track = summary.querySelector('.orders-progress-track');
    if (!track) return;

    const counts = Object.fromEntries(statusSteps.map(status => [status, 0]));
    (orders || []).forEach(order => {
      if (Object.prototype.hasOwnProperty.call(counts, order.status)) counts[order.status] += 1;
    });

    track.innerHTML = statusSteps.map(status => `
      <button type="button" class="orders-progress-step" data-status="${status}" aria-label="${statusLabels[status]}: ${counts[status]} order${counts[status] === 1 ? '' : 's'}">
        <span class="orders-progress-icon">${icons[status]}${counts[status] > 0 ? `<span class="orders-progress-badge">${counts[status] > 99 ? '99+' : counts[status]}</span>` : ''}</span>
        <span class="orders-progress-label">${statusLabels[status]}</span>
      </button>
    `).join('');

    track.querySelectorAll('.orders-progress-step').forEach(button => {
      button.addEventListener('click', () => {
        const status = button.dataset.status;
        const cards = list.querySelectorAll('.order-card');
        cards.forEach(card => {
          const statusText = card.querySelector('.order-status')?.textContent?.trim().toLowerCase();
          card.hidden = statusText !== status;
        });
        summary.classList.add('has-filter');
        summary.querySelectorAll('.orders-progress-step').forEach(item => item.classList.toggle('is-selected', item === button));
        const reset = summary.querySelector('#orders-progress-reset');
        if (reset) reset.textContent = `Show all (${orders.length})`;
      });
    });

    const reset = summary.querySelector('#orders-progress-reset');
    reset?.addEventListener('click', () => {
      list.querySelectorAll('.order-card').forEach(card => { card.hidden = false; });
      summary.classList.remove('has-filter');
      summary.querySelectorAll('.orders-progress-step').forEach(item => item.classList.remove('is-selected'));
      reset.textContent = 'All orders';
    });
  };

  const addShippingDetails = (orders) => {
    (orders || []).forEach(order => {
      if (!order.delivery_method && !order.tracking_number) return;
      const card = [...list.querySelectorAll('.order-card')].find(item =>
        item.querySelector('.order-number')?.textContent?.includes(`Order #${order.order_number}`)
      );
      if (!card || card.querySelector('.shipping-status-box')) return;

      const shippingBox = document.createElement('div');
      shippingBox.className = 'shipping-status-box';
      const title = document.createElement('p');
      title.className = 'shipping-status-title';
      title.textContent = order.status === 'delivered' ? 'Delivery details' : 'Shipping details';
      shippingBox.appendChild(title);

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
      if (items) items.before(shippingBox);
    });
  };

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

    updateSummary(orders || []);

    const observer = new MutationObserver(() => addShippingDetails(orders || []));
    observer.observe(list, { childList: true, subtree: true });
    addShippingDetails(orders || []);
  } catch (error) {
    console.error('Order progress summary error:', error);
  }
});
