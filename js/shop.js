document.addEventListener("DOMContentLoaded", async () => {
  const search = document.querySelector("#shop-search");
  const category = document.querySelector("#shop-category");
  const sort = document.querySelector("#shop-sort");
  const grid = document.querySelector("#shop-product-grid");
  const count = document.querySelector("#shop-count");
  const empty = document.querySelector("#shop-empty");
  const CART_KEY = "datihan_cart";
  let products = [];

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

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const peso = (value) => new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2
  }).format(Number(value || 0));

  const renderCategoryOptions = () => {
    const current = category.value;
    const categories = [...new Set(products.map(product => product.category).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
    category.innerHTML = '<option value="all">All categories</option>' + categories
      .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("");
    category.value = categories.includes(current) ? current : "all";
  };

  const createCard = (product) => {
    const card = document.createElement("article");
    card.className = "shop-product-card";
    card.dataset.id = product.id;
    card.dataset.name = product.name || "";
    card.dataset.category = product.category || "";
    card.dataset.price = Number(product.price || 0);

    const image = product.image_url
      ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}" loading="lazy">`
      : "PRODUCT IMAGE";

    card.innerHTML = `
      <div class="shop-product-media">
        ${image}
        <button class="wishlist-button" type="button" aria-label="Add ${escapeHtml(product.name)} to wishlist" aria-pressed="false">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.8c0 5.2-8.8 10-8.8 10s-8.8-4.8-8.8-10A4.7 4.7 0 0 1 12 6.5a4.7 4.7 0 0 1 8.8 2.3Z"></path></svg>
        </button>
      </div>
      <div class="shop-product-info">
        <p class="shop-product-name">${escapeHtml(product.name)}</p>
        <div class="shop-product-meta">
          <span>${escapeHtml(product.condition || "Good condition")}</span>
          <span class="shop-product-price">${peso(product.price)}</span>
        </div>
        <button class="button button-primary add-to-cart" type="button">Add to cart</button>
      </div>
    `;

    const cartButton = card.querySelector(".add-to-cart");
    cartButton.addEventListener("click", () => {
      const cart = readCart();
      const existing = cart.find(item => item.id === product.id);
      if (existing) {
        existing.quantity = Number(existing.quantity || 0) + 1;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price || 0),
          condition: product.condition || "Good condition",
          quantity: 1,
          image_url: product.image_url || null
        });
      }
      writeCart(cart);
      cartButton.textContent = "Added to cart";
      cartButton.disabled = true;
      window.setTimeout(() => {
        cartButton.textContent = "Add to cart";
        cartButton.disabled = false;
      }, 1000);
    });

    card.querySelector(".wishlist-button").addEventListener("click", (event) => {
      const button = event.currentTarget;
      const active = button.getAttribute("aria-pressed") === "true";
      button.setAttribute("aria-pressed", String(!active));
    });

    return card;
  };

  const renderProducts = () => {
    const query = search.value.trim().toLowerCase();
    const selectedCategory = category.value;

    let visible = products.filter(product => {
      const name = String(product.name || "").toLowerCase();
      const productCategory = product.category || "";
      return (!query || name.includes(query)) &&
        (selectedCategory === "all" || productCategory === selectedCategory);
    });

    if (sort.value === "price-low") visible.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    if (sort.value === "price-high") visible.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));

    grid.replaceChildren(...visible.map(createCard));
    count.textContent = `${visible.length} ${visible.length === 1 ? "piece" : "pieces"}`;
    empty.hidden = visible.length !== 0;
  };

  const loadProducts = async () => {
    count.textContent = "Loading pieces…";
    empty.hidden = true;

    try {
      const { data, error } = await window.datihanSupabase
        .from("products")
        .select("id, name, description, price, category, size, condition, stock, image_url, is_active, created_at")
        .eq("is_active", true)
        .gt("stock", 0)
        .order("created_at", { ascending: false });

      if (error) throw error;
      products = data || [];
      renderCategoryOptions();
      renderProducts();
    } catch (error) {
      console.error("Load shop products error:", error);
      products = [];
      grid.replaceChildren();
      count.textContent = "Unable to load pieces";
      empty.hidden = false;
      empty.querySelector("h2").textContent = "We could not load the shop.";
      empty.querySelector("p").textContent = "Please check the Supabase products read policy and refresh the page.";
    }
  };

  [search, category, sort].forEach(control => {
    control.addEventListener("input", renderProducts);
    control.addEventListener("change", renderProducts);
  });

  await loadProducts();
});
