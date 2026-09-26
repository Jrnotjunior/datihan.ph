document.addEventListener("DOMContentLoaded", async () => {
  const loadScript = (src) => new Promise((resolve, reject) => {
    const existing = [...document.scripts].find((script) => script.src === new URL(src, window.location.href).href);
    if (existing) {
      if (existing.dataset.loaded === "true") resolve();
      else {
        existing.addEventListener("load", resolve, { once: true });
        existing.addEventListener("error", reject, { once: true });
      }
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = reject;
    document.head.appendChild(script);
  });

  if (!window.datihanCartStore) {
    if (!window.supabase) await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
    if (!window.datihanSupabase) await loadScript("../js/supabase-client.js");
    await loadScript("../js/cart-store.js");
  }

  await window.datihanCartStore.ready();

  const content = document.querySelector("#cart-content");
  const itemsContainer = document.querySelector(".cart-items");
  const empty = document.querySelector("#empty-cart");
  const subtotalEl = document.querySelector("#subtotal");
  const totalEl = document.querySelector("#total");
  const checkoutLink = document.querySelector('.summary a[href="checkout.html"]');

  if (!window.datihanCartStore.isAuthenticated()) {
    const redirect = encodeURIComponent("../pages/cart.html");
    window.location.replace(`../auth/login.html?redirect=${redirect}`);
    return;
  }

  const readCart = () => window.datihanCartStore.read();
  const writeCart = (cart) => window.datihanCartStore.write(cart);
  const readSelected = () => window.datihanCartStore.readSelected();
  const writeSelected = (ids) => window.datihanCartStore.writeSelected(ids);

  const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const productImages = (item) => {
    if (Array.isArray(item.image_urls) && item.image_urls.length) return item.image_urls.filter(Boolean);
    return item.image_url ? [item.image_url] : [];
  };

  const hydrateCartProductData = async (cart) => {
    if (!window.datihanSupabase || !cart.length) return;

    const ids = [...new Set(cart.filter((item) => item.id).map((item) => String(item.id)))];
    if (!ids.length) return;

    try {
      const { data, error } = await window.datihanSupabase
        .from("products")
        .select("id, stock, image_url, image_urls")
        .in("id", ids);

      if (error) throw error;

      const productsById = new Map((data || []).map((product) => [String(product.id), product]));
      let changed = false;

      cart.forEach((item) => {
        const product = productsById.get(String(item.id));
        if (!product) return;

        const stock = Math.max(0, Number(product.stock || 0));
        if (Number(item.stock) !== stock) {
          item.stock = stock;
          changed = true;
        }

        if (stock > 0 && Number(item.quantity || 1) > stock) {
          item.quantity = stock;
          changed = true;
        }

        if (Array.isArray(product.image_urls) && product.image_urls.length) {
          const imageUrls = product.image_urls.filter(Boolean);
          if (JSON.stringify(item.image_urls || []) !== JSON.stringify(imageUrls)) {
            item.image_urls = imageUrls;
            item.image_url = imageUrls[0] || null;
            changed = true;
          }
        } else if (product.image_url && item.image_url !== product.image_url) {
          item.image_url = product.image_url;
          item.image_urls = [product.image_url];
          changed = true;
        }
      });

      if (changed) writeCart(cart);
    } catch (error) {
      console.error("Hydrate cart product data error:", error);
    }
  };

  const getSelection = (cart) => {
    const ids = cart.map((item) => String(item.id));
    const saved = readSelected();
    const selected = saved === null ? ids : saved.filter((id) => ids.includes(id));
    writeSelected(selected);
    return new Set(selected);
  };

  const render = async () => {
    const cart = readCart();
    await hydrateCartProductData(cart);
    const hydratedCart = readCart();
    const hasItems = hydratedCart.length > 0;
    const selected = getSelection(hydratedCart);

    if (content) content.style.display = hasItems ? "grid" : "none";
    if (empty) empty.style.display = hasItems ? "none" : "block";

    if (!itemsContainer || !hasItems) {
      if (subtotalEl) subtotalEl.textContent = money(0);
      if (totalEl) totalEl.textContent = money(0);
      if (checkoutLink) {
        checkoutLink.setAttribute("aria-disabled", "true");
        checkoutLink.classList.add("disabled");
      }
      return;
    }

    itemsContainer.innerHTML = `
      <div class="cart-selection-bar">
        <label class="select-all-control">
          <input type="checkbox" id="select-all-cart" ${selected.size === hydratedCart.length ? "checked" : ""}>
          <span>Select all</span>
        </label>
        <span class="selected-count" id="selected-count"></span>
      </div>
    `;

    let subtotal = 0;
    let selectedCount = 0;

    hydratedCart.forEach((item) => {
      const id = String(item.id);
      const isSelected = selected.has(id);
      const quantity = Math.max(1, Number(item.quantity || 1));
      const stock = Math.max(0, Number(item.stock || 0));
      const hasStockLimit = Number.isFinite(Number(item.stock));
      const price = Number(item.price || 0);
      const itemTotal = price * quantity;
      const images = productImages(item);
      const imageMarkup = images[0]
        ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(item.name || "Product")}" loading="lazy">`
        : `<span>PRODUCT IMAGE</span>`;
      const atStockLimit = hasStockLimit && (stock <= 0 || quantity >= stock);

      if (isSelected) {
        subtotal += itemTotal;
        selectedCount += 1;
      }

      const article = document.createElement("article");
      article.className = `cart-item${isSelected ? " selected" : ""}`;
      article.dataset.id = id;
      article.innerHTML = `
        <label class="cart-select" aria-label="Select ${escapeHtml(item.name || "product")} for checkout">
          <input type="checkbox" class="item-select" ${isSelected ? "checked" : ""}>
          <span aria-hidden="true"></span>
        </label>
        <div class="cart-image">${imageMarkup}</div>
        <div>
          <h2></h2>
          <p class="cart-meta"></p>
          <p class="cart-price"></p>
          <div class="quantity-control" aria-label="Quantity">
            <button type="button" class="quantity-minus" aria-label="Decrease quantity">−</button>
            <span class="quantity"></span>
            <button type="button" class="quantity-plus" aria-label="Increase quantity" ${atStockLimit ? "disabled" : ""}>+</button>
          </div>
          ${hasStockLimit ? `<p class="cart-stock">${stock > 0 ? `${stock} available` : "No longer available"}</p>` : ""}
          <button type="button" class="remove-item">Remove</button>
        </div>
        <p class="cart-item-total"></p>
      `;

      article.querySelector("h2").textContent = item.name || "Product";
      article.querySelector(".cart-meta").textContent = item.condition || "Good condition";
      article.querySelector(".cart-price").textContent = money(price);
      article.querySelector(".quantity").textContent = String(quantity);
      article.querySelector(".cart-item-total").textContent = money(itemTotal);

      article.querySelector(".item-select").addEventListener("change", (event) => {
        const nextSelected = new Set(readSelected() || []);
        if (event.target.checked) nextSelected.add(id);
        else nextSelected.delete(id);
        writeSelected([...nextSelected]);
        render();
      });

      article.querySelector(".quantity-minus").addEventListener("click", () => {
        const next = readCart();
        const target = next.find((entry) => String(entry.id) === id);
        if (!target) return;
        target.quantity = Math.max(1, Number(target.quantity || 1) - 1);
        writeCart(next);
        render();
      });

      article.querySelector(".quantity-plus").addEventListener("click", () => {
        const next = readCart();
        const target = next.find((entry) => String(entry.id) === id);
        if (!target) return;

        const targetStock = Number(target.stock);
        const currentQuantity = Number(target.quantity || 0);
        if (Number.isFinite(targetStock) && currentQuantity >= targetStock) return;

        target.quantity = currentQuantity + 1;
        writeCart(next);
        render();
      });

      article.querySelector(".remove-item").addEventListener("click", () => {
        const next = readCart().filter((entry) => String(entry.id) !== id);
        writeSelected((readSelected() || []).filter((selectedId) => selectedId !== id));
        writeCart(next);
        render();
      });

      itemsContainer.appendChild(article);
    });

    const selectedCountEl = itemsContainer.querySelector("#selected-count");
    if (selectedCountEl) {
      selectedCountEl.textContent = selectedCount === 0
        ? "No items selected"
        : `${selectedCount} ${selectedCount === 1 ? "item" : "items"} selected`;
    }

    itemsContainer.querySelector("#select-all-cart")?.addEventListener("change", (event) => {
      writeSelected(event.target.checked ? hydratedCart.map((item) => String(item.id)) : []);
      render();
    });

    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (totalEl) totalEl.textContent = money(subtotal);

    if (checkoutLink) {
      const enabled = selectedCount > 0;
      checkoutLink.classList.toggle("disabled", !enabled);
      if (enabled) checkoutLink.removeAttribute("aria-disabled");
      else checkoutLink.setAttribute("aria-disabled", "true");
    }
  };

  checkoutLink?.addEventListener("click", (event) => {
    const cart = readCart();
    const selected = readSelected() || [];
    if (!cart.length || !selected.some((id) => cart.some((item) => String(item.id) === id))) {
      event.preventDefault();
      render();
    }
  });

  render();
  window.addEventListener("datihan-cart-updated", render);
  window.addEventListener("storage", render);
});
