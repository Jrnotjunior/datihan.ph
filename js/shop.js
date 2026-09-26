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

  const productImages = (product) => Array.isArray(product.image_urls) && product.image_urls.length
    ? product.image_urls.filter(Boolean)
    : (product.image_url ? [product.image_url] : []);

  const getCartQuantity = (productId) => {
    const item = readCart().find((entry) => String(entry.id) === String(productId));
    return item ? Math.max(0, Number(item.quantity || 0)) : 0;
  };

  const updateCartButton = (button, product) => {
    const stock = Math.max(0, Number(product.stock || 0));
    const quantityInCart = getCartQuantity(product.id);
    const limitReached = quantityInCart >= stock;

    button.textContent = limitReached ? "Already added on cart" : "Add to cart";
    button.setAttribute("aria-label", limitReached
      ? `${product.name} is already added to cart up to the available quantity`
      : `Add ${product.name} to cart`);
  };

  const imageLightbox = document.createElement("div");
  imageLightbox.className = "shop-image-lightbox";
  imageLightbox.hidden = true;
  imageLightbox.innerHTML = `
    <div class="shop-image-lightbox-backdrop" data-lightbox-close></div>
    <div class="shop-image-lightbox-dialog" role="dialog" aria-modal="true" aria-label="Product images">
      <button class="shop-image-lightbox-close" type="button" aria-label="Close image" data-lightbox-close>
        <svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>
      </button>
      <button class="shop-image-lightbox-nav shop-image-lightbox-prev" type="button" aria-label="Previous photo">‹</button>
      <img class="shop-image-lightbox-image" alt="">
      <button class="shop-image-lightbox-nav shop-image-lightbox-next" type="button" aria-label="Next photo">›</button>
      <p class="shop-image-lightbox-count" aria-live="polite"></p>
    </div>`;
  document.body.appendChild(imageLightbox);

  const lightboxImage = imageLightbox.querySelector(".shop-image-lightbox-image");
  const prevButton = imageLightbox.querySelector(".shop-image-lightbox-prev");
  const nextButton = imageLightbox.querySelector(".shop-image-lightbox-next");
  const lightboxCount = imageLightbox.querySelector(".shop-image-lightbox-count");
  let lightboxImages = [];
  let lightboxIndex = 0;
  let lightboxAlt = "";

  const renderLightbox = () => {
    if (!lightboxImages.length) return;
    lightboxImage.src = lightboxImages[lightboxIndex];
    lightboxImage.alt = lightboxAlt || "Product image";
    lightboxCount.textContent = lightboxImages.length > 1
      ? `${lightboxIndex + 1} / ${lightboxImages.length}`
      : "";
    const multi = lightboxImages.length > 1;
    prevButton.hidden = !multi;
    nextButton.hidden = !multi;
  };

  const closeLightbox = () => {
    imageLightbox.hidden = true;
    document.body.classList.remove("shop-lightbox-open");
    lightboxImage.removeAttribute("src");
    lightboxImages = [];
  };

  const openLightbox = (images, alt) => {
    if (!images.length) return;
    lightboxImages = images;
    lightboxIndex = 0;
    lightboxAlt = alt || "Product image";
    renderLightbox();
    imageLightbox.hidden = false;
    document.body.classList.add("shop-lightbox-open");
  };

  prevButton.addEventListener("click", () => {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length;
    renderLightbox();
  });

  nextButton.addEventListener("click", () => {
    if (!lightboxImages.length) return;
    lightboxIndex = (lightboxIndex + 1) % lightboxImages.length;
    renderLightbox();
  });

  imageLightbox.addEventListener("click", (event) => {
    if (event.target.closest("[data-lightbox-close]")) closeLightbox();
  });

  document.addEventListener("keydown", (event) => {
    if (imageLightbox.hidden) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") prevButton.click();
    if (event.key === "ArrowRight") nextButton.click();
  });

  const renderCategoryOptions = () => {
    const current = category.value;
    const categories = [...new Set(products.map((p) => p.category).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));
    category.innerHTML = `<option value="all">All categories</option>${categories
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("")}`;
    category.value = categories.includes(current) ? current : "all";
  };

  const createCard = (product) => {
    const card = document.createElement("article");
    card.className = "shop-product-card";
    card.dataset.id = product.id;
    card.dataset.name = product.name || "";
    card.dataset.category = product.category || "";
    card.dataset.price = Number(product.price || 0);

    const images = productImages(product);
    const image = images[0]
      ? `<button class="shop-product-image-button" type="button" aria-label="View ${escapeHtml(product.name)} images">
          <img src="${escapeHtml(images[0])}" alt="${escapeHtml(product.name)}" loading="lazy">
          ${images.length > 1 ? `<span class="shop-product-photo-count">${images.length}</span>` : ""}
        </button>`
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
      </div>`;

    const imageButton = card.querySelector(".shop-product-image-button");
    if (imageButton) imageButton.addEventListener("click", () => openLightbox(images, product.name));

    const cartButton = card.querySelector(".add-to-cart");
    updateCartButton(cartButton, product);

    cartButton.addEventListener("click", () => {
      const cart = readCart();
      const existing = cart.find((item) => String(item.id) === String(product.id));
      const currentQuantity = existing ? Number(existing.quantity || 0) : 0;
      const stock = Math.max(0, Number(product.stock || 0));

      if (currentQuantity >= stock) {
        cartButton.textContent = "Already added on cart";
        return;
      }

      if (existing) {
        existing.quantity = currentQuantity + 1;
        existing.stock = stock;
      } else {
        cart.push({
          id: product.id,
          name: product.name,
          category: product.category,
          price: Number(product.price || 0),
          condition: product.condition || "Good condition",
          quantity: 1,
          stock,
          image_url: images[0] || null,
          image_urls: images
        });
      }

      writeCart(cart);
      updateCartButton(cartButton, product);
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
    let visible = products.filter((product) => {
      const name = String(product.name || "").toLowerCase();
      const productCategory = product.category || "";
      return (!query || name.includes(query))
        && (selectedCategory === "all" || productCategory === selectedCategory);
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
        .select("id, name, description, price, category, size, condition, stock, image_url, image_urls, is_active, created_at")
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

  [search, category, sort].forEach((control) => {
    control.addEventListener("input", renderProducts);
    control.addEventListener("change", renderProducts);
  });

  window.addEventListener("datihan-cart-updated", () => {
    grid.querySelectorAll(".shop-product-card").forEach((card) => {
      const product = products.find((item) => String(item.id) === String(card.dataset.id));
      if (product) updateCartButton(card.querySelector(".add-to-cart"), product);
    });
  });

  await loadProducts();
});
