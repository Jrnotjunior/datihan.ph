document.addEventListener('DOMContentLoaded', async () => {
  const supabase = window.datihanSupabase;
  const list = document.querySelector('#orders-list');
  const main = document.querySelector('.orders-main');
  if (!supabase || !list || !main) return;

  const steps = ['pending','confirmed','preparing','shipped','delivered'];
  const labels = {pending:'Pending',confirmed:'Confirmed',preparing:'Preparing',shipped:'Shipped',delivered:'Delivered'};
  const icons = {
    pending:'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"></circle><path d="M12 7.5v5l3 2"></path></svg>',
    confirmed:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.2 4.2L19 7"></path></svg>',
    preparing:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 8 8-4 8 4-8 4-8-4Z"></path><path d="m4 8 8 4 8-4v8l-8 4-8-4V8Z"></path><path d="M12 12v8"></path></svg>',
    shipped:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h11v10H3z"></path><path d="M14 10h4l3 3v3h-7z"></path><circle cx="7" cy="18" r="1.7"></circle><circle cx="18" cy="18" r="1.7"></circle></svg>',
    delivered:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7"></path><path d="M5.5 9.5V21h13V9.5"></path><path d="M9.5 21v-6h5v6"></path></svg>'
  };

  const summary = document.createElement('section');
  summary.id = 'orders-progress-summary';
  summary.className = 'orders-progress-summary';
  summary.setAttribute('aria-label','Order progress summary');
  summary.innerHTML = `<div class="orders-progress-heading"><div><p class="eyebrow">ORDER PROGRESS</p><p class="orders-progress-subtitle">Select a status to view those orders.</p></div><label class="orders-progress-all"><input type="checkbox" id="orders-progress-all-checkbox"><span>View all orders</span></label></div><div class="orders-progress-track" role="list"></div>`;
  main.querySelector('.orders-header')?.after(summary);

  let selectedStatus = null;
  const filterOrders = status => {
    selectedStatus = status;
    const cards = list.querySelectorAll('.order-card');
    let visible = 0;
    cards.forEach(card => {
      const cardStatus = card.dataset.orderStatus || card.querySelector('.order-status')?.textContent?.trim().toLowerCase();
      const show = !status || cardStatus === status;
      card.hidden = !show;
      if (show) visible++;
    });
    summary.classList.toggle('has-filter', !!status);
    summary.querySelectorAll('.orders-progress-step').forEach(btn => btn.classList.toggle('is-selected', btn.dataset.status === status));
    const checkbox = summary.querySelector('#orders-progress-all-checkbox');
    if (checkbox) checkbox.checked = !status;
    let empty = list.querySelector('.orders-filter-empty');
    if (status && cards.length && !visible) {
      if (!empty) { empty = document.createElement('p'); empty.className = 'orders-filter-empty'; list.appendChild(empty); }
      empty.textContent = `No ${labels[status].toLowerCase()} orders right now.`;
      empty.hidden = false;
    } else if (empty) empty.hidden = true;
  };

  const addShippingDetails = orders => {
    (orders || []).forEach(order => {
      if (!order.delivery_method && !order.tracking_number) return;
      const card = [...list.querySelectorAll('.order-card')].find(item => item.querySelector('.order-number')?.textContent?.includes(`Order #${order.order_number}`));
      if (!card || card.querySelector('.shipping-status-box')) return;
      const box = document.createElement('div');
      box.className = 'shipping-status-box';
      const title = document.createElement('p');
      title.className = 'shipping-status-title';
      title.textContent = order.status === 'delivered' ? 'Delivery details' : 'Shipping details';
      box.appendChild(title);
      if (order.delivery_method) { const p=document.createElement('p'); p.innerHTML='<span>Delivery method</span><strong></strong>'; p.querySelector('strong').textContent=order.delivery_method; box.appendChild(p); }
      if (order.tracking_number) { const p=document.createElement('p'); p.innerHTML='<span>Tracking / Reference</span><strong></strong>'; p.querySelector('strong').textContent=order.tracking_number; box.appendChild(p); }
      card.querySelector('.order-items')?.before(box);
    });
  };

  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const userId = sessionData.session?.user?.id;
    if (!userId) return;
    const { data: orders, error } = await supabase.from('orders').select('order_number,status,delivery_method,tracking_number').eq('user_id',userId);
    if (error) throw error;

    const counts = Object.fromEntries(steps.map(s => [s,0]));
    (orders || []).forEach(order => { if (Object.hasOwn(counts,order.status)) counts[order.status]++; });
    summary.querySelector('.orders-progress-track').innerHTML = steps.map(status => `<button type="button" class="orders-progress-step" data-status="${status}" aria-label="${labels[status]}: ${counts[status]} order${counts[status]===1?'':'s'}"><span class="orders-progress-icon">${icons[status]}${counts[status] ? `<span class="orders-progress-badge">${counts[status]>99?'99+':counts[status]}</span>` : ''}</span><span class="orders-progress-label">${labels[status]}</span></button>`).join('');
    summary.querySelectorAll('.orders-progress-step').forEach(btn => btn.addEventListener('click', () => filterOrders(btn.dataset.status)));
    summary.querySelector('#orders-progress-all-checkbox')?.addEventListener('change', event => filterOrders(event.target.checked ? null : (steps.find(s => counts[s] > 0) || null)));

    const firstActive = steps.find(s => counts[s] > 0) || null;
    selectedStatus = firstActive;

    // Observe only direct changes to the order list. Do not observe the
    // entire subtree, because adding shipping details would retrigger this observer.
    const observer = new MutationObserver(mutations => {
      if (!mutations.some(mutation => mutation.type === 'childList' && mutation.target === list)) return;
      addShippingDetails(orders || []);
      if (selectedStatus) filterOrders(selectedStatus);
    });
    observer.observe(list,{childList:true});

    addShippingDetails(orders || []);
    filterOrders(firstActive);
    requestAnimationFrame(() => {
      addShippingDetails(orders || []);
      if (selectedStatus) filterOrders(selectedStatus);
    });
  } catch (error) {
    console.error('Order progress summary error:',error);
  }
});
