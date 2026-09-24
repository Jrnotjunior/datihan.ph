(() => {
  const supabase = window.datihanSupabase;

  const activeProducts = document.getElementById('active-products');
  const availableUnits = document.getElementById('available-units');
  const openOrders = document.getElementById('open-orders');
  const upcomingEvents = document.getElementById('upcoming-events');
  const recentOrders = document.getElementById('recent-orders');
  const errorBox = document.getElementById('dashboard-error');

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function money(value) {
    return `₱${Number(value || 0).toLocaleString('en-PH', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    })}`;
  }

  function dateLabel(value) {
    if (!value) return 'No date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'No date';
    return date.toLocaleDateString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  async function getSession() {
    if (!supabase) throw new Error('Supabase client is not available.');
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session?.user?.id) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.hidden = false;
    errorBox.textContent = message;
  }

  async function loadDashboard() {
    try {
      const session = await getSession();
      const ownerId = session.user.id;

      const [productsResult, ordersResult, eventsResult] = await Promise.all([
        supabase
          .from('products')
          .select('id, name, stock, is_active, created_at')
          .eq('owner_id', ownerId)
          .order('created_at', { ascending: false }),
        supabase
          .from('orders')
          .select('id, order_number, total, status, created_at')
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('pop_up_events')
          .select('id, title, event_date, status')
          .eq('owner_id', ownerId)
          .gte('event_date', new Date().toISOString().slice(0, 10))
          .order('event_date', { ascending: true })
      ]);

      if (productsResult.error) throw productsResult.error;
      if (ordersResult.error) throw ordersResult.error;
      if (eventsResult.error) throw eventsResult.error;

      const products = productsResult.data || [];
      const orders = ordersResult.data || [];
      const events = eventsResult.data || [];
      const active = products.filter(product => product.is_active !== false);
      const stock = products.reduce((sum, product) => sum + Number(product.stock || 0), 0);
      const open = orders.filter(order => !['delivered', 'cancelled'].includes(String(order.status || '').toLowerCase())).length;

      activeProducts.textContent = active.length.toLocaleString('en-PH');
      availableUnits.textContent = stock.toLocaleString('en-PH');
      openOrders.textContent = open.toLocaleString('en-PH');
      upcomingEvents.textContent = events.length.toLocaleString('en-PH');

      if (!orders.length) {
        recentOrders.innerHTML = '<div class="empty-state"><h3>No recent orders.</h3><p>New customer orders will appear here.</p></div>';
      } else {
        recentOrders.innerHTML = orders.map(order => `
          <a class="dashboard-order" href="orders.html">
            <div class="dashboard-order-main">
              <strong>${escapeHtml(order.order_number || 'Order')}</strong>
              <span>${dateLabel(order.created_at)}</span>
            </div>
            <div class="dashboard-order-side">
              <strong>${money(order.total)}</strong>
              <span>${escapeHtml(String(order.status || 'pending'))}</span>
            </div>
          </a>
        `).join('');
      }
    } catch (error) {
      console.error('Load dashboard error:', error);
      activeProducts.textContent = '—';
      availableUnits.textContent = '—';
      openOrders.textContent = '—';
      upcomingEvents.textContent = '—';
      recentOrders.innerHTML = '<div class="empty-state"><h3>We could not load your dashboard.</h3><p>Check your Supabase policies and refresh the page.</p></div>';
      showError(error.message || 'Unable to load dashboard data.');
    }
  }

  window.addEventListener('datihan-auth-ready', loadDashboard);
  if (document.documentElement.classList.contains('auth-ready')) loadDashboard();
})();
