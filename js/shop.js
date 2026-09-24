document.addEventListener("DOMContentLoaded", () => {
  const search = document.querySelector("#shop-search");
  const category = document.querySelector("#shop-category");
  const sort = document.querySelector("#shop-sort");
  const cards = [...document.querySelectorAll(".shop-product-card")];
  const count = document.querySelector("#shop-count");
  const empty = document.querySelector("#shop-empty");
  const CART_KEY = "datihan_cart";

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

  const addToCart = (card, button) => {
    const product = {
      id: card.dataset.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
      name: card.dataset.name,
      category: card.dataset.category,
      price: Number(card.dataset.price),
      condition: card.querySelector(".shop-product-meta span:first-child")?.textContent.trim() || "Good condition"
    };

    const cart = readCart();
    const existing = cart.find((item) => item.id === product.id);

    if (existing) {
      existing.quantity = Number(existing.quantity || 0) + 1;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    writeCart(cart);
    button.textContent = "Added to cart";
    button.disabled = true;
    setTimeout(() => {
      button.textContent = "Add to cart";
      button.disabled = false;
    }, 1000);
  };

  cards.forEach((card) => {
    if (card.querySelector(".add-to-cart")) return;
    const info = card.querySelector(".shop-product-info");
    if (!info) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "button button-primary add-to-cart";
    button.textContent = "Add to cart";
    button.addEventListener("click", () => addToCart(card, button));
    info.appendChild(button);
  });

  const filterProducts = () => {
    const query = search.value.trim().toLowerCase();
    const selectedCategory = category.value;
    let visible = cards.filter((card) => {
      const name = card.dataset.name.toLowerCase();
      const cardCategory = card.dataset.category;
      return (!query || name.includes(query)) && (selectedCategory === "all" || cardCategory === selectedCategory);
    });

    if (sort.value === "price-low") visible.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
    if (sort.value === "price-high") visible.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));

    cards.forEach((card) => { card.hidden = !visible.includes(card); });
    visible.forEach((card) => card.parentElement.appendChild(card));
    count.textContent = `${visible.length} ${visible.length === 1 ? "piece" : "pieces"}`;
    empty.style.display = visible.length ? "none" : "block";
  };

  [search, category, sort].forEach((control) => control.addEventListener("input", filterProducts));
  [category, sort].forEach((control) => control.addEventListener("change", filterProducts));

  document.querySelectorAll(".wishlist-button").forEach((button) => {
    button.addEventListener("click", () => {
      const active = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!active));
    });
  });

  filterProducts();
});
