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

  const getSelection = (cart) => {
    const ids = cart.map(item => String(item.id));
    const saved = readSelected();

    // First visit: select every cart item so the existing checkout flow stays intact.
    // Afterwards, keep only selections that still exist in the cart.
    const selected = saved === null ? ids : saved.filter(id => ids.includes(id));
    writeSelected(selected);
    return new Set(selected);
  };

  const render = () => {
    const cart = readCart();
    const hasItems = cart.length > 0;
    const selected = getSelection(cart);

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
          <input type="checkbox" id="select-all-cart" ${selected.size === cart.length ? "checked" : ""}>
          <span>Select all</span>
        </label>
        <span class="selected-count" id="selected-count"></span>
      </div>
    `;

    let subtotal = 0;
    let selectedCount = 0;

    cart.forEach((item) => {
      const id = String(item.id);
      const isSelected = selected.has(id);
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.price || 0);
      const itemTotal = price * quantity;

      if (isSelected) {
        subtotal += itemTotal;
        selectedCount += 1;
      }

      const article = document.createElement("article");
      article.className = `cart-item${isSelected ? " selected" : ""}`;
      article.dataset.id = id;
      article.innerHTML = `
        <label class="cart-select" aria-label="Select ${item.name || "product"} for checkout">
          <input type="checkbox" class="item-select" ${isSelected ? "checked" : ""}>
          <span aria-hidden="true"></span>
        </label>
        <div class="cart-image">PRODUCT IMAGE</div>
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
      writeSelected(event.target.checked ? cart.map(item => String(item.id)) : []);
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
