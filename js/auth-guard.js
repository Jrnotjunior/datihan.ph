document.addEventListener('DOMContentLoaded', async () => {
  try {
    const { data, error } = await window.datihanSupabase.auth.getSession();
    if (error || !data.session) {
      window.location.replace('../auth/login.html');
      return;
    }

    const user = data.session.user;
    const { data: profile, error: profileError } = await window.datihanSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.role) {
      await window.datihanSupabase.auth.signOut();
      window.location.replace('../auth/login.html');
      return;
    }

    const role = profile.role;
    const path = window.location.pathname;
    const isAdminPage = path.includes('/admin/');
    const isOwnerPage = path.includes('/owner/');
    const isBuyerAccountPage = path.includes('/account/');

    if (isAdminPage && role !== 'admin') {
      window.location.replace(role === 'shop_owner' ? '../owner/dashboard.html' : '../account/');
      return;
    }

    if (isOwnerPage && role !== 'shop_owner') {
      window.location.replace(role === 'admin' ? '../admin/dashboard.html' : '../account/');
      return;
    }

    if (isBuyerAccountPage && role !== 'buyer') {
      window.location.replace(role === 'admin' ? '../admin/dashboard.html' : '../owner/dashboard.html');
      return;
    }

    window.datihanAuthSession = data.session;
    window.datihanAuthProfile = profile;
    document.documentElement.classList.add('auth-ready');

    document.querySelectorAll('[data-auth-user-email]').forEach(el => {
      const userEmail = user.email || '';
      if ('value' in el) el.value = userEmail;
      else el.textContent = userEmail;
    });

    if (isOwnerPage) {
      const pageMain = document.querySelector('.page-main');
      const existingNav = document.querySelector('.owner-nav');

      if (existingNav) {
        const existingLinks = existingNav.querySelector('.owner-nav-links') || existingNav.querySelector(':scope > div');
        if (existingLinks && !existingLinks.querySelector('a[href="shipping.html"]')) {
          const shippingLink = document.createElement('a');
          shippingLink.href = 'shipping.html';
          shippingLink.textContent = 'Shipping';
          shippingLink.dataset.page = 'shipping.html';
          existingLinks.appendChild(shippingLink);
        }
      }

      if (pageMain && !existingNav) {
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
            <a href="shipping.html" data-page="shipping.html">Shipping</a>
            <a href="promotions.html" data-page="promotions.html">Promotions</a>
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

    window.dispatchEvent(new CustomEvent('datihan-auth-ready', {
      detail: { session: data.session, profile }
    }));
  } catch (error) {
    console.error('Auth guard error:', error);
    window.location.replace('../auth/login.html');
  }
});
