document.addEventListener("DOMContentLoaded", () => {
  const CART_KEY = "datihan_cart";
  const SELECTED_KEY = "datihan_selected_cart_items";
  const content = document.querySelector("#cart-content");
  const itemsContainer = document.querySelector(".cart-items");
  const empty = document.querySelector("#empty-cart");
  const subtotalEl = document.querySelector("#subtotal");
  const totalEl = document.querySelector("#total");
  const checkoutLink = document.querySelector('.summary a[href="checkout.html"]');

  const readCart = () => {
    try {
      const cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
      return Array.isArray(cart) ? cart : [];
    } catch (_) {
      return [];
    }
  };

  const writeCart = (cart) => {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    window.dispatchEvent(new Event("datihan-cart-updated"));
  };

  const readSelected = () => {
    try {
      const value = JSON.parse(localStorage.getItem(SELECTED_KEY) || "null");
      return Array.isArray(value) ? value.map(String) : null;
    } catch (_) {
      return null;
    }
  };

  const writeSelected = (ids) => {
    localStorage.setItem(SELECTED_KEY, JSON.stringify(ids.map(String)));
  };

  const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;
  const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const productImages = (item) => {
    if (Array.isArray(item.image_urls) && item.image_urls.length) return item.image_urls.filter(Boolean);
    return item.image_url ? [item.image_url] : [];
  };

  // Older cart entries may have been saved before image URLs were added to the cart object.
  // Hydrate those entries from the current product records so existing carts also get images.
  const hydrateMissingImages = async (cart) => {
    if (!window.datihanSupabase) return;

    const missingIds = cart
      .filter((item) => !productImages(item).length && item.id)
      .map((item) => String(item.id));

    if (!missingIds.length) return;

    try {
      const { data, error } = await window.datihanSupabase
        .from("products")
        .select("id, image_url, image_urls")
        .in("id", missingIds);

      if (error) throw error;

      const productsById = new Map((data || []).map((product) => [String(product.id), product]));
      let changed = false;

      cart.forEach((item) => {
        const product = productsById.get(String(item.id));
        if (!product) return;

        if (Array.isArray(product.image_urls) && product.image_urls.length) {
          item.image_urls = product.image_urls.filter(Boolean);
          item.image_url = item.image_urls[0] || null;
          changed = true;
        } else if (product.image_url) {
          item.image_url = product.image_url;
          item.image_urls = [product.image_url];
          changed = true;
        }
      });

      if (changed) localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch (error) {
      console.error("Hydrate cart product images error:", error);
    }
  };

  const getSelection = (cart) => {
    const ids = cart.map(item => String(item.id));
    const saved = readSelected();

    // First visit: select every cart item so the existing checkout flow stays intact.
    // Afterwards, keep only selections that still exist in the cart.
    const selected = saved === null ? ids : saved.filter(id => ids.includes(id));
    writeSelected(selected);
    return new Set(selected);
  };

  const render = async () => {
    const cart = readCart();
    await hydrateMissingImages(cart);
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
      const price = Number(item.price || 0);
      const itemTotal = price * quantity;
      const images = productImages(item);
      const imageMarkup = images[0]
        ? `<img src="${escapeHtml(images[0])}" alt="${escapeHtml(item.name || "Product")}" loading="lazy">`
        : `<span>PRODUCT IMAGE</span>`;

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
            <button type="button" class="quantity-plus" aria-label="Increase quantity">+</button>
          </div>
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
        target.quantity = Number(target.quantity || 1) + 1;
        writeCart(next);
        render();
      });

      article.querySelector(".remove-item").addEventListener("click", () => {
        const next = readCart().filter((entry) => String(entry.id) !== id);
        writeSelected((readSelected() || []).filter(selectedId => selectedId !== id));
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
      writeSelected(event.target.checked ? hydratedCart.map(item => String(item.id)) : []);
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
    if (!cart.length || !selected.some(id => cart.some(item => String(item.id) === id))) {
      event.preventDefault();
      render();
    }
  });

  render();
  window.addEventListener("datihan-cart-updated", render);
  window.addEventListener("storage", render);
});
