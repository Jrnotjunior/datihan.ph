(() => {
  const supabaseClient = window.datihanSupabase;
  const state = { editingId: null, products: [], pendingDeleteId: null };

  const list = document.getElementById('products-list');
  const modal = document.getElementById('product-modal');
  const form = document.getElementById('product-form');
  const modalTitle = document.getElementById('product-modal-title');
  const saveButton = document.getElementById('save-product');
  const toast = document.getElementById('toast');
  const searchInput = document.getElementById('product-search');
  const categoryFilter = document.getElementById('category-filter');
  const deleteModal = document.getElementById('product-delete-confirm-modal');
  const deleteConfirmButton = document.getElementById('product-delete-confirm-button');
  const deleteCancelButton = document.getElementById('product-delete-cancel-button');

  const fields = {
    name: document.getElementById('product-name'),
    description: document.getElementById('product-description'),
    price: document.getElementById('product-price'),
    category: document.getElementById('product-category'),
    size: document.getElementById('product-size'),
    condition: document.getElementById('product-condition'),
    stock: document.getElementById('product-stock'),
    imageUrl: document.getElementById('product-image-url'),
    active: document.getElementById('product-active')
  };

  function showToast(message, isError = false) {
    toast.textContent = message;
    toast.classList.toggle('error', isError);
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function peso(value) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function filteredProducts() {
    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;
    return state.products.filter(product => {
      const matchesQuery = !query || [product.name, product.description, product.category, product.size, product.condition]
        .filter(Boolean).some(value => String(value).toLowerCase().includes(query));
      const matchesCategory = !category || product.category === category;
      return matchesQuery && matchesCategory;
    });
  }

  function renderCategoryFilter() {
    const current = categoryFilter.value;
    const categories = [...new Set(state.products.map(product => product.category).filter(Boolean))].sort();
    categoryFilter.innerHTML = '<option value="">All categories</option>' + categories
      .map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
    categoryFilter.value = categories.includes(current) ? current : '';
  }

  function renderProducts() {
    const products = filteredProducts();
    if (!products.length) {
      list.innerHTML = '<div class="empty-state"><h3>No products found.</h3><p>Try another search or add your first product.</p></div>';
      return;
    }

    list.innerHTML = products.map(product => `
      <article class="product-card">
        <div class="product-image">
          ${product.image_url ? `<img src="${escapeHtml(product.image_url)}" alt="${escapeHtml(product.name)}">` : '<span>PRODUCT</span>'}
        </div>
        <div class="product-content">
          <div class="product-heading">
            <div>
              <p class="eyebrow">${escapeHtml(product.category || 'Uncategorized')}</p>
              <h2>${escapeHtml(product.name)}</h2>
            </div>
            <strong>${peso(product.price)}</strong>
          </div>
          ${product.description ? `<p class="product-description">${escapeHtml(product.description)}</p>` : ''}
          <div class="product-meta">
            <span>Stock: <strong>${Number(product.stock || 0)}</strong></span>
            ${product.size ? `<span>Size: ${escapeHtml(product.size)}</span>` : ''}
            ${product.condition ? `<span>${escapeHtml(product.condition)}</span>` : ''}
            <span class="status-badge ${product.is_active ? '' : 'inactive'}">${product.is_active ? 'Active' : 'Hidden'}</span>
          </div>
          <div class="product-actions">
            <button class="button button-secondary button-small" type="button" data-action="edit" data-id="${escapeHtml(product.id)}">Edit</button>
            <button class="button button-secondary button-small" type="button" data-action="delete" data-id="${escapeHtml(product.id)}">Delete</button>
          </div>
        </div>
      </article>
    `).join('');
  }

  async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  async function loadProducts() {
    list.innerHTML = '<p class="loading">Loading products...</p>';
    try {
      const session = await getSession();
      const { data, error } = await supabaseClient
        .from('products')
        .select('id, owner_id, name, description, price, category, size, condition, stock, image_url, is_active, created_at, updated_at')
        .eq('owner_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      state.products = data || [];
      renderCategoryFilter();
      renderProducts();
    } catch (error) {
      console.error('Load products error:', error);
      list.innerHTML = '<div class="empty-state"><h3>We could not load your products.</h3><p>Please check your Supabase products policies and refresh the page.</p></div>';
      showToast(error.message || 'Unable to load products.', true);
    }
  }

  function openModal(product = null) {
    state.editingId = product?.id || null;
    modalTitle.textContent = product ? 'Edit product' : 'Add product';
    saveButton.textContent = product ? 'Save changes' : 'Add product';
    fields.name.value = product?.name || '';
    fields.description.value = product?.description || '';
    fields.price.value = product?.price ?? '';
    fields.category.value = product?.category || '';
    fields.size.value = product?.size || '';
    fields.condition.value = product?.condition || '';
    fields.stock.value = product?.stock ?? 0;
    fields.imageUrl.value = product?.image_url || '';
    fields.active.checked = product?.is_active !== false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => fields.name.focus(), 0);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    state.editingId = null;
    form.reset();
    fields.stock.value = 0;
    fields.active.checked = true;
  }

  function openDeleteConfirmation(id) {
    const product = state.products.find(item => item.id === id);
    if (!product || !deleteModal) return;

    state.pendingDeleteId = id;
    const message = document.getElementById('product-delete-confirm-message');
    if (message) {
      message.textContent = `“${product.name}” will be permanently removed from your shop.`;
    }

    deleteModal.hidden = false;
    deleteConfirmButton?.focus();
  }

  function closeDeleteConfirmation() {
    if (deleteModal) deleteModal.hidden = true;
    state.pendingDeleteId = null;
  }

  async function confirmDeleteProduct() {
    const id = state.pendingDeleteId;
    if (!id) return;

    if (deleteConfirmButton) {
      deleteConfirmButton.disabled = true;
      deleteConfirmButton.textContent = 'Deleting...';
    }

    try {
      closeDeleteConfirmation();
      await deleteProduct(id);
    } finally {
      if (deleteConfirmButton) {
        deleteConfirmButton.disabled = false;
        deleteConfirmButton.textContent = 'Delete product';
      }
    }
  }

  async function saveProduct(event) {
    event.preventDefault();
    if (!fields.name.value.trim()) return showToast('Product name is required.', true);
    if (Number(fields.price.value) < 0 || Number(fields.stock.value) < 0) return showToast('Price and stock cannot be negative.', true);

    saveButton.disabled = true;
    saveButton.textContent = state.editingId ? 'Saving...' : 'Adding...';

    try {
      const session = await getSession();
      const payload = {
        name: fields.name.value.trim(),
        description: fields.description.value.trim() || null,
        price: Number(fields.price.value || 0),
        category: fields.category.value.trim() || null,
        size: fields.size.value.trim() || null,
        condition: fields.condition.value || null,
        stock: Number(fields.stock.value || 0),
        image_url: fields.imageUrl.value.trim() || null,
        is_active: fields.active.checked,
        updated_at: new Date().toISOString()
      };

      if (state.editingId) {
        const { error } = await supabaseClient.from('products').update(payload)
          .eq('id', state.editingId).eq('owner_id', session.user.id);
        if (error) throw error;
        closeModal();
        showToast('Product updated successfully.');
      } else {
        const { error } = await supabaseClient.from('products').insert({ ...payload, owner_id: session.user.id });
        if (error) throw error;
        closeModal();
        showToast('Product added successfully.');
      }
      await loadProducts();
    } catch (error) {
      console.error('Save product error:', error);
      showToast(error.message || 'Unable to save the product.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = state.editingId ? 'Save changes' : 'Add product';
    }
  }

  async function deleteProduct(id) {
    const product = state.products.find(item => item.id === id);
    if (!product) return;

    try {
      const session = await getSession();
      const { error } = await supabaseClient.from('products').delete()
        .eq('id', id).eq('owner_id', session.user.id);
      if (error) throw error;
      showToast('Product deleted successfully.');
      await loadProducts();
    } catch (error) {
      console.error('Delete product error:', error);
      showToast(error.message || 'Unable to delete the product.', true);
    }
  }

  document.getElementById('add-product-button').addEventListener('click', () => openModal());
  document.getElementById('close-product-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-product').addEventListener('click', closeModal);
  form.addEventListener('submit', saveProduct);
  searchInput.addEventListener('input', renderProducts);
  categoryFilter.addEventListener('change', renderProducts);

  deleteCancelButton?.addEventListener('click', closeDeleteConfirmation);
  document.getElementById('product-delete-confirm-backdrop')?.addEventListener('click', closeDeleteConfirmation);
  deleteConfirmButton?.addEventListener('click', confirmDeleteProduct);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (deleteModal && !deleteModal.hidden) closeDeleteConfirmation();
    else if (modal.classList.contains('is-open')) closeModal();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const product = state.products.find(item => item.id === button.dataset.id);
    if (!product) return;
    if (button.dataset.action === 'edit') openModal(product);
    if (button.dataset.action === 'delete') openDeleteConfirmation(product.id);
  });

  window.addEventListener('datihan-auth-ready', loadProducts);
  if (document.documentElement.classList.contains('auth-ready')) loadProducts();
})();
