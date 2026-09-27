document.addEventListener('DOMContentLoaded', async () => {
  const cartStore = window.datihanCartStore;
  const itemsEl = document.querySelector('#checkout-items');
  if (!cartStore || !itemsEl) return;

  await cartStore.ready();

  const renderImages = () => {
    const cart = Array.isArray(cartStore.read()) ? cartStore.read() : [];
    const selected = cartStore.readSelected();
    const selectedIds = selected === null
      ? new Set(cart.map(item => String(item.id)))
      : new Set(Array.isArray(selected) ? selected.map(String) : []);
    const selectedCart = cart.filter(item => selectedIds.has(String(item.id)));

    itemsEl.querySelectorAll('.checkout-item').forEach(row => {
      const imageEl = row.querySelector('.checkout-image');
      const nameEl = row.querySelector('.checkout-item-name');
      if (!imageEl || !nameEl || imageEl.dataset.imageRendered === 'true') return;

      const item = selectedCart.find(cartItem => String(cartItem.name || '') === String(nameEl.textContent || ''));
      const images = Array.isArray(item?.image_urls) && item.image_urls.length
        ? item.image_urls.filter(Boolean)
        : (item?.image_url ? [item.image_url] : []);
      const imageUrl = images[0];

      if (!imageUrl) return;

      imageEl.textContent = '';
      const img = document.createElement('img');
      img.src = imageUrl;
      img.alt = item?.name || 'Product image';
      img.loading = 'lazy';
      img.addEventListener('error', () => {
        imageEl.textContent = 'PRODUCT';
        imageEl.dataset.imageRendered = 'true';
      }, { once: true });
      imageEl.appendChild(img);
      imageEl.dataset.imageRendered = 'true';
    });
  };

  const observer = new MutationObserver(renderImages);
  observer.observe(itemsEl, { childList: true, subtree: true });
  renderImages();
});
