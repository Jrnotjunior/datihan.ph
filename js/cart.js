document.addEventListener("DOMContentLoaded", () => {
  const CART_KEY = "datihan_cart";
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

  const money = (value) => `₱${Number(value || 0).toLocaleString("en-PH")}`;

  const render = () => {
    const cart = readCart();
    const hasItems = cart.length > 0;

    if (content) content.style.display = hasItems ? "grid" : "none";
    if (empty) empty.style.display = hasItems ? "none" : "block";

    if (!itemsContainer || !hasItems) {
      if (subtotalEl) subtotalEl.textContent = money(0);
      if (totalEl) totalEl.textContent = money(0);
      if (checkoutLink) checkoutLink.setAttribute("aria-disabled", "true");
      return;
    }

    itemsContainer.innerHTML = "";
    let subtotal = 0;

    cart.forEach((item) => {
      const quantity = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.price || 0);
      const itemTotal = price * quantity;
      subtotal += itemTotal;

      const article = document.createElement("article");
      article.className = "cart-item";
      article.dataset.id = item.id;
      article.innerHTML = `
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

      article.querySelector(".quantity-minus").addEventListener("click", () => {
        const next = readCart();
        const target = next.find((entry) => entry.id === item.id);
        if (!target) return;
        target.quantity = Math.max(1, Number(target.quantity || 1) - 1);
        writeCart(next);
        render();
      });

      article.querySelector(".quantity-plus").addEventListener("click", () => {
        const next = readCart();
        const target = next.find((entry) => entry.id === item.id);
        if (!target) return;
        target.quantity = Number(target.quantity || 1) + 1;
        writeCart(next);
        render();
      });

      article.querySelector(".remove-item").addEventListener("click", () => {
        const next = readCart().filter((entry) => entry.id !== item.id);
        writeCart(next);
        render();
      });

      itemsContainer.appendChild(article);
    });

    if (subtotalEl) subtotalEl.textContent = money(subtotal);
    if (totalEl) totalEl.textContent = money(subtotal);
    if (checkoutLink) checkoutLink.removeAttribute("aria-disabled");
  };

  render();
  window.addEventListener("datihan-cart-updated", render);
  window.addEventListener("storage", render);
});
