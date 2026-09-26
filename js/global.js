document.addEventListener("DOMContentLoaded", () => {
  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  const path = window.location.pathname;
  const assetPrefix = path.includes("/pages/") || path.includes("/account/") || path.includes("/auth/") ? "../" : "";

  const loadScript = (src, test) => {
    if (test?.()) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const ensureCartStore = async () => {
    try {
      if (!window.datihanSupabase) {
        if (!window.supabase?.createClient) {
          await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", () => Boolean(window.supabase?.createClient));
        }
        if (!window.datihanSupabase) {
          await loadScript(`${assetPrefix}js/supabase-client.js`, () => Boolean(window.datihanSupabase));
        }
      }
      if (!window.datihanCartStore) {
        await loadScript(`${assetPrefix}js/cart-store.js`, () => Boolean(window.datihanCartStore));
      }
      if (window.datihanCartStore?.ready) await window.datihanCartStore.ready();
    } catch (error) {
      console.error("Cart store setup error:", error);
    }
  };

  // Keep the storefront header consistent across every page.
  const accountLinks = document.querySelectorAll('.header-actions a[href*="login"], .header-actions a[href*="auth"], .header-actions a[href*="profile"]');
  const cartLinks = document.querySelectorAll('.header-actions a[href*="cart"]');

  const accountIcon = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5"></circle>
      <path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"></path>
    </svg>`;

  const cartIcon = `
    <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 5h2l1.5 10h9.8L20 8H7"></path>
      <circle cx="9" cy="19" r="1"></circle>
      <circle cx="17" cy="19" r="1"></circle>
    </svg>`;

  const removeLegacyEmoji = (link, emoji) => {
    [...link.childNodes].forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.includes(emoji)) node.remove();
    });
  };

  accountLinks.forEach((link) => {
    removeLegacyEmoji(link, '👤');
    if (!link.querySelector(".icon")) link.insertAdjacentHTML("afterbegin", accountIcon);
    link.classList.add("icon-link");
    const accountPath = window.location.pathname.includes("/pages/")
      ? "../account/profile.html"
      : window.location.pathname.includes("/account/")
        ? "profile.html"
        : window.location.pathname.includes("/auth/")
          ? "../account/profile.html"
          : "account/profile.html";
    link.setAttribute("href", accountPath);
  });

  cartLinks.forEach((link) => {
    removeLegacyEmoji(link, '🛒');
    if (!link.querySelector(".icon")) link.insertAdjacentHTML("afterbegin", cartIcon);
    link.classList.add("icon-link");
    let badge = link.querySelector(".cart-count");
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "cart-count";
      badge.setAttribute("aria-label", "Cart item count");
      link.appendChild(badge);
    }
    link.querySelectorAll(".cart-count").forEach((candidate) => {
      if (candidate !== badge) candidate.remove();
    });
    if (badge.parentElement !== link) link.appendChild(badge);
  });

  // Keep the cart on the left and the account icon on the right.
  const headerActions = document.querySelector(".header-actions");
  if (headerActions) {
    cartLinks.forEach((link) => headerActions.appendChild(link));
    accountLinks.forEach((link) => headerActions.appendChild(link));
  }

  // Responsive mobile navigation uses the existing main navigation links.
  const header = document.querySelector(".site-header");
  const mainNav = header?.querySelector(".main-nav");
  if (header && mainNav && !header.querySelector(".mobile-menu-toggle")) {
    const menuToggle = document.createElement("button");
    menuToggle.type = "button";
    menuToggle.className = "mobile-menu-toggle";
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.innerHTML = `
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
      </svg>`;
    header.appendChild(menuToggle);

    const setMenuState = (open) => {
      header.classList.toggle("menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      menuToggle.innerHTML = open
        ? `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path></svg>`;
    };
    menuToggle.addEventListener("click", () => setMenuState(!header.classList.contains("menu-open")));
    mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuState(false)));
    window.addEventListener("resize", () => { if (window.innerWidth > 900) setMenuState(false); });
  }

  const renderCartCount = (count) => {
    document.querySelectorAll(".header-actions .cart-count").forEach((el) => {
      el.textContent = String(count);
      el.hidden = count === 0;
      el.setAttribute("aria-label", `${count} ${count === 1 ? "item" : "items"} in cart`);
    });
  };

  // Cart state is account-scoped. Never show a previous user's badge after logout.
  const updateCartCount = async () => {
    try {
      await ensureCartStore();
      if (!window.datihanCartStore?.isAuthenticated?.()) {
        renderCartCount(0);
        return;
      }
      const cart = window.datihanCartStore.read();
      const count = Array.isArray(cart) ? cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;
      renderCartCount(count);
    } catch (_) {
      renderCartCount(0);
    }
  };

  renderCartCount(0);
  updateCartCount();
  window.addEventListener("storage", updateCartCount);
  window.addEventListener("datihan-cart-updated", updateCartCount);
  window.addEventListener("pageshow", updateCartCount);

  // Render one shared buyer-facing footer on every storefront page.
  if (!document.querySelector(".site-footer")) {
    const footer = document.createElement("footer");
    footer.className = "site-footer storefront-footer";
    footer.style.gridTemplateColumns = "minmax(320px, 1.4fr) minmax(170px, 0.75fr) minmax(220px, 1fr)";
    footer.innerHTML = `
      <div class="footer-column footer-about">
        <a class="footer-brand" href="${window.location.pathname.includes("/pages/") ? "../index.html" : "index.html"}">DATIHAN</a>
        <p>Pre-loved pants, shirts, and shoes — sold and consigned at pop-ups around the city, no storefront required.</p>
      </div>
      <div class="footer-column footer-explore">
        <h2>Explore</h2>
        <nav class="footer-links" aria-label="Footer explore navigation">
          <a href="${window.location.pathname.includes("/pages/") ? "shop.html" : "pages/shop.html"}">Shop</a>
          <a href="${window.location.pathname.includes("/pages/") ? "pop-ups.html" : "pages/pop-ups.html"}">Pop-ups</a>
          <a href="${window.location.pathname.includes("/pages/") ? "contact.html" : "pages/contact.html"}">Contact</a>
          <a href="${window.location.pathname.includes("/pages/") ? "about.html" : "pages/about.html"}">About</a>
        </nav>
      </div>
      <div class="footer-column footer-follow">
        <h2>Follow along</h2>
        <div class="footer-social-icons" aria-label="DATIHAN social media">
          <a class="footer-social-icon" href="https://www.instagram.com/datihan.ph/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg></a>
          <a class="footer-social-icon" href="https://www.tiktok.com/@datihan.ph" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4v10.2a4.8 4.8 0 1 1-4-4.73"></path><path d="M15 4c.7 2.2 2.1 3.5 4.5 3.8"></path></svg></a>
          <a class="footer-social-icon" href="https://www.facebook.com/profile.php?id=61577434115016" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z"></path></svg></a>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© <span class="footer-current-year">${new Date().getFullYear()}</span> DATIHAN.PH. All items sold as-is unless noted.</p>
        <p>Pop-ups posted on Instagram, TikTok &amp; Facebook</p>
      </div>`;
    document.body.appendChild(footer);
  }
});
