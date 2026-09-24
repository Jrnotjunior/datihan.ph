document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data, error } = await window.datihanSupabase.auth.getSession();
    if (error || !data.session) {
      window.location.replace('../auth/login.html');
      return;
    }

    window.datihanAuthSession = data.session;
    document.documentElement.classList.add('auth-ready');

    document.querySelectorAll('[data-auth-user-email]').forEach(el => {
      const userEmail = data.session.user.email || '';
      if ('value' in el) el.value = userEmail;
      else el.textContent = userEmail;
    });

    if (window.location.pathname.includes('/owner/')) {
      const pageMain = document.querySelector('.page-main');
      if (pageMain && !document.querySelector('.owner-nav')) {
        const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
        const nav = document.createElement('nav');
        nav.className = 'owner-nav';
        nav.setAttribute('aria-label', 'Shop owner navigation');

        const dashboardLink = currentPage !== 'dashboard.html'
          ? '<a class="owner-nav-home" href="dashboard.html">← Dashboard</a>'
          : '';

        nav.innerHTML = `
          ${dashboardLink}
          <div class="owner-nav-links">
            <a href="products.html" data-page="products.html">Products</a>
            <a href="inventory.html" data-page="inventory.html">Inventory</a>
            <a href="orders.html" data-page="orders.html">Orders</a>
            <a href="pop-ups.html" data-page="pop-ups.html">Pop-ups</a>
          </div>
        `;

        nav.querySelectorAll('[data-page]').forEach(link => {
          if (link.dataset.page === currentPage) {
            link.classList.add('is-active');
            link.setAttribute('aria-current', 'page');
          }
        });

        pageMain.prepend(nav);
      }
    }

    window.dispatchEvent(new CustomEvent('datihan-auth-ready', { detail: { session: data.session } }));
  } catch (error) {
    console.error('Auth guard error:', error);
    window.location.replace('../auth/login.html');
  }
});
