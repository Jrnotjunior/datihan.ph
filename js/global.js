document.addEventListener("DOMContentLoaded", () => {
  // global.js is the single source of truth for the public/shared header
  // and footer. It is safe to load on every page.
  if (window.__datihanGlobalInitialized) return;
  window.__datihanGlobalInitialized = true;

  const path = window.location.pathname;
  const inPages = path.includes("/pages/");
  const inAccount = path.includes("/account/");
  const inAuth = path.includes("/auth/");
  const assetPrefix = inPages || inAccount || inAuth ? "../" : "";
  const rootPrefix = assetPrefix;

  const publicPath = (page) => {
    if (inPages) return page;
    if (inAccount || inAuth) return `../pages/${page}`;
    return `pages/${page}`;
  };

  const accountPath = () => {
    if (inAccount) return "profile.html";
    return `${rootPrefix}account/profile.html`;
  };

  const cartPath = () => {
    if (inPages) return "cart.html";
    return `${rootPrefix}pages/cart.html`;
  };

  const homePath = () => `${rootPrefix}index.html`;

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

  const menuIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
    </svg>`;

  const closeIcon = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"></path>
    </svg>`;

  const existingHeader = document.querySelector(".site-header");

  // Normalize the existing public header instead of allowing individual HTML
  // pages to maintain their own header markup.
  if (existingHeader) {
    existingHeader.innerHTML = `
      <a class="brand" href="${homePath()}" aria-label="DATIHAN.PH home">DATIHAN.PH</a>
      <nav class="main-nav" aria-label="Main navigation">
        <a href="${publicPath("shop.html")}">Shop</a>
        <a href="${publicPath("pop-ups.html")}">Pop-ups</a>
        <a href="${publicPath("about.html")}">About</a>
      </nav>
      <div class="header-actions">
        <a href="${accountPath()}" class="icon-link" aria-label="Account">
          ${accountIcon}
        </a>
        <a href="${cartPath()}" class="icon-link" data-global-cart-link aria-label="Shopping cart" hidden aria-hidden="true">
          ${cartIcon}<span class="cart-count" aria-label="Cart item count" hidden>0</span>
        </a>
      </div>`;
  }

  // One mobile-menu controller for the normalized header.
  const header = document.querySelector(".site-header");
  const mainNav = header?.querySelector(".main-nav");
  if (header && mainNav) {
    const oldToggle = header.querySelector(".mobile-menu-toggle");
    if (oldToggle) oldToggle.remove();

    const menuToggle = document.createElement("button");
    menuToggle.type = "button";
    menuToggle.className = "mobile-menu-toggle";
    menuToggle.setAttribute("aria-label", "Open navigation menu");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.innerHTML = menuIcon;
    header.appendChild(menuToggle);

    const setMenuState = (open) => {
      header.classList.toggle("menu-open", open);
      menuToggle.setAttribute("aria-expanded", String(open));
      menuToggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
      menuToggle.innerHTML = open ? closeIcon : menuIcon;
    };

    menuToggle.addEventListener("click", () => setMenuState(!header.classList.contains("menu-open")));
    mainNav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenuState(false)));
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) setMenuState(false);
    });
  }

  const year = document.querySelector("#current-year");
  if (year) year.textContent = new Date().getFullYear();

  const cartLinks = document.querySelectorAll("[data-global-cart-link]");

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

  const renderCartCount = (count, authenticated) => {
    cartLinks.forEach((link) => {
      link.hidden = !authenticated;
      link.setAttribute("aria-hidden", String(!authenticated));
      const badge = link.querySelector(".cart-count");
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = !authenticated || count === 0;
      }
    });
  };

  const updateCartCount = async () => {
    try {
      await ensureCartStore();
      const authenticated = Boolean(window.datihanCartStore?.isAuthenticated?.());
      if (!authenticated) {
        renderCartCount(0, false);
        return;
      }
      const cart = window.datihanCartStore.read();
      const count = Array.isArray(cart)
        ? cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
        : 0;
      renderCartCount(count, true);
    } catch (_) {
      renderCartCount(0, false);
    }
  };

  renderCartCount(0, false);
  updateCartCount();
  window.addEventListener("storage", updateCartCount);
  window.addEventListener("datihan-cart-updated", updateCartCount);
  window.addEventListener("pageshow", updateCartCount);

  // Remove any page-specific footer and create exactly one shared footer.
  // This makes the global footer independent of individual HTML templates.
  document.querySelectorAll(".site-footer").forEach((footer) => footer.remove());

  const footer = document.createElement("footer");
  footer.className = "site-footer storefront-footer";
  footer.innerHTML = `
    <div class="footer-column footer-about">
      <a class="footer-brand" href="${homePath()}">DATIHAN</a>
      <p>Pre-loved pants, shirts, and shoes — sold and consigned at pop-ups around the city, no storefront required.</p>
    </div>
    <div class="footer-column footer-explore">
      <h2>Explore</h2>
      <nav class="footer-links" aria-label="Footer explore navigation">
        <a href="${publicPath("shop.html")}">Shop</a>
        <a href="${publicPath("pop-ups.html")}">Pop-ups</a>
        <a href="${publicPath("contact.html")}">Contact</a>
        <a href="${publicPath("about.html")}">About</a>
      </nav>
    </div>
    <div class="footer-column footer-explore footer-legal">
      <h2>Policies</h2>
      <nav class="footer-links" aria-label="Footer policy navigation">
        <a href="${publicPath("refund-policy.html")}">Refund Policy</a>
        <a href="${publicPath("terms-of-service.html")}">Terms of Service</a>
        <a href="${publicPath("privacy-policy.html")}">Privacy Policy</a>
        <a href="${publicPath("consignment-policy.html")}">Consignment Policy</a>
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
});
