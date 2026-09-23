document.addEventListener("DOMContentLoaded", () => {
  const search = document.querySelector("#shop-search");
  const category = document.querySelector("#shop-category");
  const sort = document.querySelector("#shop-sort");
  const cards = [...document.querySelectorAll(".shop-product-card")];
  const count = document.querySelector("#shop-count");
  const empty = document.querySelector("#shop-empty");

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
