document.addEventListener("DOMContentLoaded", () => {
  if (window.__datihanGlobalInitialized) return;
  window.__datihanGlobalInitialized = true;

  const path = window.location.pathname;
  const inPages = path.includes("/pages/");
  const inAccount = path.includes("/account/");
  const inAuth = path.includes("/auth/");
  const assetPrefix = inPages || inAccount || inAuth ? "../" : "";

  const publicPath = (page) => {
    if (inPages) return page;
    if (inAccount || inAuth) return `../pages/${page}`;
    return `pages/${page}`;
  };
  const accountPath = () => inAccount ? "profile.html" : `${assetPrefix}account/profile.html`;
  const cartPath = () => inPages ? "cart.html" : `${assetPrefix}pages/cart.html`;
  const homePath = () => `${assetPrefix}index.html`;

  const accountIcon = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"></circle><path d="M5 20c.7-3.2 3.1-5 7-5s6.3 1.8 7 5"></path></svg>`;
  const cartIcon = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h2l1.5 10h9.8L20 8H7"></path><circle cx="9" cy="19" r="1"></circle><circle cx="17" cy="19" r="1"></circle></svg>`;

  document.querySelectorAll(".site-header").forEach((el) => el.remove());
  const header = document.createElement("header");
  header.className = "site-header";
  header.innerHTML = `
    <a class="brand" href="${homePath()}" aria-label="DATIHAN.PH home">DATIHAN.PH</a>
    <nav class="main-nav" aria-label="Main navigation">
      <a href="${publicPath("shop.html")}">Shop</a>
      <a href="${publicPath("pop-ups.html")}">Pop-ups</a>
      <a href="${publicPath("about.html")}">About</a>
    </nav>
    <div class="header-actions">
      <a href="${accountPath()}" class="icon-link" aria-label="Account">${accountIcon}</a>
      <a href="${cartPath()}" class="icon-link" data-global-cart-link aria-label="Shopping cart" hidden aria-hidden="true">${cartIcon}</a>
    </div>`;
  document.body.insertBefore(header, document.body.firstChild);

  if (!document.querySelector("#datihan-mobile-header-nav-style")) {
    const style = document.createElement("style");
    style.id = "datihan-mobile-header-nav-style";
    style.textContent = `
      @media (max-width: 900px) {
        body .site-header {
          grid-template-columns: minmax(0, 1fr) auto auto;
          grid-template-rows: 1fr;
          gap: 0.45rem;
        }
        body .site-header .main-nav {
          display: flex !important;
          position: static;
          grid-column: 2;
          grid-row: 1;
          width: auto;
          min-width: 0;
          padding: 0;
          margin: 0;
          flex-direction: row;
          align-items: center;
          justify-content: flex-end;
          gap: 0.6rem;
          background: transparent;
          border-radius: 0;
          box-shadow: none;
          white-space: nowrap;
          overflow: visible;
        }
        body .site-header .main-nav a {
          font-size: 11px;
          line-height: 1;
        }
        body .site-header .header-actions {
          grid-column: 3;
          grid-row: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.15rem;
        }
        body .site-header .header-actions .icon-link {
          width: 32px;
          height: 32px;
          flex-basis: 32px;
        }
      }
      @media (max-width: 520px) {
        body .site-header {
          gap: 0.3rem;
          padding-left: 0.7rem;
          padding-right: 0.7rem;
        }
        body .site-header .main-nav {
          gap: 0.45rem;
        }
        body .site-header .main-nav a {
          font-size: 10px;
        }
        body .site-header .header-actions .icon-link {
          width: 30px;
          height: 30px;
          flex-basis: 30px;
        }
      }
    `;
    document.head.appendChild(style);
  }

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
        if (!window.supabase?.createClient) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2", () => Boolean(window.supabase?.createClient));
        if (!window.datihanSupabase) await loadScript(`${assetPrefix}js/supabase-client.js`, () => Boolean(window.datihanSupabase));
      }
      if (!window.datihanCartStore) await loadScript(`${assetPrefix}js/cart-store.js`, () => Boolean(window.datihanCartStore));
      if (window.datihanCartStore?.ready) await window.datihanCartStore.ready();
    } catch (error) { console.error("Cart store setup error:", error); }
  };

  const cartLinks = document.querySelectorAll("[data-global-cart-link]");
  const renderCartCount = (count, authenticated) => {
    cartLinks.forEach((link) => {
      link.hidden = !authenticated;
      link.setAttribute("aria-hidden", String(!authenticated));
      let badge = link.querySelector(".cart-count");
      if (!badge) { badge = document.createElement("span"); badge.className = "cart-count"; link.appendChild(badge); }
      badge.textContent = String(count);
      badge.hidden = !authenticated || count === 0;
    });
  };
  const updateCartCount = async () => {
    try {
      await ensureCartStore();
      const authenticated = Boolean(window.datihanCartStore?.isAuthenticated?.());
      if (!authenticated) return renderCartCount(0, false);
      const cart = window.datihanCartStore.read();
      const count = Array.isArray(cart) ? cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : 0;
      renderCartCount(count, true);
    } catch (_) { renderCartCount(0, false); }
  };
  renderCartCount(0, false);
  updateCartCount();
  window.addEventListener("storage", updateCartCount);
  window.addEventListener("datihan-cart-updated", updateCartCount);
  window.addEventListener("pageshow", updateCartCount);

  document.querySelectorAll(".site-footer").forEach((el) => el.remove());
  const footer = document.createElement("footer");
  footer.className = "site-footer storefront-footer";
  footer.innerHTML = `
    <div class="footer-column footer-about"><a class="footer-brand" href="${homePath()}">DATIHAN</a><p>Pre-loved pants, shirts, and shoes — sold and consigned at pop-ups around the city, no storefront required.</p></div>
    <div class="footer-column footer-explore"><h2>Explore</h2><nav class="footer-links" aria-label="Footer explore navigation"><a href="${publicPath("shop.html")}">Shop</a><a href="${publicPath("pop-ups.html")}">Pop-ups</a><a href="${publicPath("contact.html")}">Contact</a><a href="${publicPath("about.html")}">About</a></nav></div>
    <div class="footer-column footer-explore footer-legal"><h2>Policies</h2><nav class="footer-links" aria-label="Footer policy navigation"><a href="${publicPath("refund-policy.html")}">Refund Policy</a><a href="${publicPath("terms-of-service.html")}">Terms of Service</a><a href="${publicPath("privacy-policy.html")}">Privacy Policy</a><a href="${publicPath("consignment-policy.html")}">Consignment Policy</a></nav></div>
    <div class="footer-column footer-follow"><h2>Follow along</h2><div class="footer-social-icons" aria-label="DATIHAN social media"><a class="footer-social-icon" href="https://www.instagram.com/datihan.ph/" target="_blank" rel="noopener noreferrer" aria-label="Instagram" title="Instagram"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"></rect><circle cx="12" cy="12" r="4"></circle><circle cx="17.5" cy="6.5" r="1"></circle></svg></a><a class="footer-social-icon" href="https://www.tiktok.com/@datihan.ph" target="_blank" rel="noopener noreferrer" aria-label="TikTok" title="TikTok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4v10.2a4.8 4.8 0 1 1-4-4.73"></path><path d="M15 4c.7 2.2 2.1 3.5 4.5 3.8"></path></svg></a><a class="footer-social-icon" href="https://www.facebook.com/profile.php?id=61577434115016" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-.7.3-1 1-1Z"></path></svg></a></div></div>
    <div class="footer-bottom">
      <p>© <span class="footer-current-year">${new Date().getFullYear()}</span> DATIHAN.PH. All items sold as-is unless noted.</p>
      <p class="footer-developer-credit">Designed &amp; Developed by <a class="footer-developer-logo-link" href="https://jrnotjunior.github.io/Jorel-Jr-Somoza---Resume/" target="_blank" rel="noopener noreferrer" aria-label="Jorel Jr Somoza resume"><img src="${assetPrefix}jrlogo.jpg" alt="Jorel logo" class="footer-developer-logo"></a></p>
      <p class="footer-social-note">Pop-ups posted on Instagram, TikTok &amp; Facebook</p>
    </div>`;
  document.body.appendChild(footer);

  if (!document.querySelector("#datihan-footer-credit-style")) {
    const style = document.createElement("style");
    style.id = "datihan-footer-credit-style";
    style.textContent = `
      .footer-bottom { position: relative; }
      .footer-developer-credit { position: absolute; left: 50%; transform: translateX(-50%); white-space: nowrap; display: inline-flex; align-items: center; gap: 0.45rem; }
      .footer-developer-logo-link { display: inline-flex; align-items: center; border-radius: 50%; line-height: 0; }
      .footer-developer-logo { width: 30px; height: 30px; object-fit: contain; border-radius: 50%; vertical-align: middle; transition: opacity .2s ease, transform .2s ease; }
      .footer-developer-logo-link:hover .footer-developer-logo { opacity: .8; transform: scale(1.06); }
      @media (max-width: 520px) {
        .footer-developer-credit { position: static; transform: none; white-space: normal; justify-content: center; }
      }
    `;
    document.head.appendChild(style);
  }
});