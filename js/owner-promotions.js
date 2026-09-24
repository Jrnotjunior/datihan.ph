(() => {
  const supabaseClient = window.datihanSupabase;
  const state = { editingId: null, promotions: [], products: [], pendingDeleteId: null };

  const list = document.getElementById('promotions-list');
  const modal = document.getElementById('promotion-modal');
  const form = document.getElementById('promotion-form');
  const modalTitle = document.getElementById('promotion-modal-title');
  const saveButton = document.getElementById('save-promotion');
  const toast = document.getElementById('toast');
  const searchInput = document.getElementById('promotion-search');
  const statusFilter = document.getElementById('promotion-status-filter');
  const productPicker = document.getElementById('promotion-products');
  const deleteModal = document.getElementById('promotion-delete-confirm-modal');
  const deleteConfirmButton = document.getElementById('promotion-delete-confirm-button');
  const deleteCancelButton = document.getElementById('promotion-delete-cancel-button');

  const fields = {
    title: document.getElementById('promotion-title'),
    description: document.getElementById('promotion-description'),
    type: document.getElementById('promotion-discount-type'),
    value: document.getElementById('promotion-discount-value'),
    code: document.getElementById('promotion-code'),
    startDate: document.getElementById('promotion-start-date'),
    endDate: document.getElementById('promotion-end-date'),
    active: document.getElementById('promotion-active')
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
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
  }

  function peso(value) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return '—';
    return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
  }

  function getScheduleStatus(promotion) {
    if (!promotion.is_active) return { label: 'Inactive', className: 'inactive' };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = promotion.start_date ? new Date(`${promotion.start_date}T00:00:00`) : null;
    const end = promotion.end_date ? new Date(`${promotion.end_date}T23:59:59`) : null;
    if (start && start > today) return { label: 'Upcoming', className: 'upcoming' };
    if (end && end < today) return { label: 'Expired', className: 'expired' };
    return { label: 'Active', className: 'active' };
  }

  function promotionValue(promotion) {
    return promotion.discount_type === 'percentage'
      ? `${Number(promotion.discount_value || 0)}% OFF`
      : `${peso(promotion.discount_value)} OFF`;
  }

  function productNames(promotion) {
    const ids = promotion.product_ids || [];
    if (!ids.length) return 'All products';
    const names = ids.map(id => state.products.find(product => product.id === id)?.name).filter(Boolean);
    return names.length ? names.join(', ') : 'Selected products';
  }

  function filteredPromotions() {
    const query = searchInput.value.trim().toLowerCase();
    const filter = statusFilter.value;
    return state.promotions.filter(promotion => {
      const matchesQuery = !query || [promotion.title, promotion.description, promotion.code]
        .filter(Boolean).some(value => String(value).toLowerCase().includes(query));
      const status = getScheduleStatus(promotion).label.toLowerCase();
      return matchesQuery && (!filter || status === filter);
    });
  }

  function renderPromotions() {
    const promotions = filteredPromotions();
    if (!promotions.length) {
      list.innerHTML = '<div class="empty-state"><h3>No promotions found.</h3><p>Create a promotion or try another search/filter.</p></div>';
      return;
    }

    list.innerHTML = promotions.map(promotion => {
      const status = getScheduleStatus(promotion);
      return `
        <article class="promotion-card">
          <div class="promotion-heading">
            <div>
              <span class="status-badge ${status.className}">${status.label}</span>
              <h2>${escapeHtml(promotion.title)}</h2>
            </div>
            <strong class="promotion-value">${escapeHtml(promotionValue(promotion))}</strong>
          </div>
          ${promotion.description ? `<p class="promotion-description">${escapeHtml(promotion.description)}</p>` : ''}
          <div class="promotion-meta">
            <span>${formatDate(promotion.start_date)}${promotion.end_date ? ` – ${formatDate(promotion.end_date)}` : ' – No end date'}</span>
            <span>${escapeHtml(productNames(promotion))}</span>
            ${promotion.code ? `<span>Code: <strong>${escapeHtml(promotion.code)}</strong></span>` : ''}
          </div>
          <div class="promotion-actions">
            <button class="button button-secondary button-small" type="button" data-action="edit" data-id="${escapeHtml(promotion.id)}">Edit</button>
            <button class="button button-secondary button-small" type="button" data-action="delete" data-id="${escapeHtml(promotion.id)}">Delete</button>
          </div>
        </article>`;
    }).join('');
  }

  async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  async function loadData() {
    list.innerHTML = '<p class="loading">Loading promotions...</p>';
    try {
      const session = await getSession();
      const [{ data: promotions, error: promotionsError }, { data: products, error: productsError }] = await Promise.all([
        supabaseClient.from('promotions').select('id, owner_id, title, description, discount_type, discount_value, code, product_ids, start_date, end_date, is_active, created_at, updated_at').eq('owner_id', session.user.id).order('created_at', { ascending: false }),
        supabaseClient.from('products').select('id, name').eq('owner_id', session.user.id).eq('is_active', true).order('name')
      ]);
      if (promotionsError) throw promotionsError;
      if (productsError) throw productsError;
      state.promotions = promotions || [];
      state.products = products || [];
      renderProductPicker([]);
      renderPromotions();
    } catch (error) {
      console.error('Load promotions error:', error);
      list.innerHTML = '<div class="empty-state"><h3>We could not load promotions.</h3><p>Make sure the promotions table and its Supabase policies have been created, then refresh.</p></div>';
      showToast(error.message || 'Unable to load promotions.', true);
    }
  }

  function renderProductPicker(selectedIds = []) {
    if (!state.products.length) {
      productPicker.innerHTML = '<p style="color:var(--brown);font-size:14px">No active products are available. This promotion will apply to all products.</p>';
      return;
    }
    const selected = new Set(selectedIds);
    productPicker.innerHTML = state.products.map(product => `
      <label class="product-option">
        <input type="checkbox" value="${escapeHtml(product.id)}" ${selected.has(product.id) ? 'checked' : ''}>
        <span>${escapeHtml(product.name)}</span>
      </label>`).join('');
  }

  function openModal(promotion = null) {
    state.editingId = promotion?.id || null;
    modalTitle.textContent = promotion ? 'Edit promotion' : 'Add promotion';
    saveButton.textContent = promotion ? 'Save changes' : 'Add promotion';
    fields.title.value = promotion?.title || '';
    fields.description.value = promotion?.description || '';
    fields.type.value = promotion?.discount_type || 'percentage';
    fields.value.value = promotion?.discount_value ?? '';
    fields.code.value = promotion?.code || '';
    fields.startDate.value = promotion?.start_date || '';
    fields.endDate.value = promotion?.end_date || '';
    fields.active.checked = promotion?.is_active !== false;
    renderProductPicker(promotion?.product_ids || []);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => fields.title.focus(), 0);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    state.editingId = null;
    form.reset();
    fields.type.value = 'percentage';
    fields.active.checked = true;
    renderProductPicker([]);
  }

  function openDeleteConfirmation(id) {
    const promotion = state.promotions.find(item => item.id === id);
    if (!promotion) return;
    state.pendingDeleteId = id;
    const message = document.getElementById('promotion-delete-confirm-message');
    if (message) message.textContent = `“${promotion.title}” will be permanently removed from your shop.`;
    deleteModal.hidden = false;
    deleteConfirmButton?.focus();
  }

  function closeDeleteConfirmation() {
    deleteModal.hidden = true;
    state.pendingDeleteId = null;
  }

  async function confirmDeletePromotion() {
    const id = state.pendingDeleteId;
    if (!id) return;
    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = 'Deleting...';
    try {
      const session = await getSession();
      const { error } = await supabaseClient.from('promotions').delete().eq('id', id).eq('owner_id', session.user.id);
      if (error) throw error;
      closeDeleteConfirmation();
      showToast('Promotion deleted successfully.');
      await loadData();
    } catch (error) {
      console.error('Delete promotion error:', error);
      showToast(error.message || 'Unable to delete the promotion.', true);
    } finally {
      deleteConfirmButton.disabled = false;
      deleteConfirmButton.textContent = 'Delete promotion';
    }
  }

  function selectedProductIds() {
    return [...productPicker.querySelectorAll('input[type="checkbox"]:checked')].map(input => input.value);
  }

  async function savePromotion(event) {
    event.preventDefault();
    if (!fields.title.value.trim()) return showToast('Promotion title is required.', true);
    const value = Number(fields.value.value);
    if (!Number.isFinite(value) || value <= 0) return showToast('Discount value must be greater than 0.', true);
    if (fields.type.value === 'percentage' && value > 100) return showToast('Percentage discount cannot exceed 100%.', true);
    if (fields.startDate.value && fields.endDate.value && fields.endDate.value < fields.startDate.value) return showToast('End date cannot be before the start date.', true);

    saveButton.disabled = true;
    saveButton.textContent = state.editingId ? 'Saving...' : 'Adding...';
    try {
      const session = await getSession();
      const payload = {
        title: fields.title.value.trim(),
        description: fields.description.value.trim() || null,
        discount_type: fields.type.value,
        discount_value: value,
        code: fields.code.value.trim().toUpperCase() || null,
        product_ids: selectedProductIds(),
        start_date: fields.startDate.value || null,
        end_date: fields.endDate.value || null,
        is_active: fields.active.checked,
        updated_at: new Date().toISOString()
      };

      if (state.editingId) {
        const { error } = await supabaseClient.from('promotions').update(payload).eq('id', state.editingId).eq('owner_id', session.user.id);
        if (error) throw error;
        showToast('Promotion updated successfully.');
      } else {
        const { error } = await supabaseClient.from('promotions').insert({ ...payload, owner_id: session.user.id });
        if (error) throw error;
        showToast('Promotion added successfully.');
      }
      closeModal();
      await loadData();
    } catch (error) {
      console.error('Save promotion error:', error);
      showToast(error.message || 'Unable to save the promotion.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = state.editingId ? 'Save changes' : 'Add promotion';
    }
  }

  document.getElementById('add-promotion-button').addEventListener('click', () => openModal());
  document.getElementById('close-promotion-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-promotion').addEventListener('click', closeModal);
  form.addEventListener('submit', savePromotion);
  searchInput.addEventListener('input', renderPromotions);
  statusFilter.addEventListener('change', renderPromotions);
  deleteCancelButton.addEventListener('click', closeDeleteConfirmation);
  document.getElementById('promotion-delete-confirm-backdrop').addEventListener('click', closeDeleteConfirmation);
  deleteConfirmButton.addEventListener('click', confirmDeletePromotion);
  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!deleteModal.hidden) closeDeleteConfirmation();
    else if (modal.classList.contains('is-open')) closeModal();
  });
  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const promotion = state.promotions.find(item => item.id === button.dataset.id);
    if (!promotion) return;
    if (button.dataset.action === 'edit') openModal(promotion);
    if (button.dataset.action === 'delete') openDeleteConfirmation(promotion.id);
  });

  window.addEventListener('datihan-auth-ready', loadData);
  if (document.documentElement.classList.contains('auth-ready')) loadData();
})();
