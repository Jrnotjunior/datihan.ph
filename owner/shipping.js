(() => {
  const supabaseClient = window.datihanSupabase;
  const state = { editingId: null, rates: [], pendingDeleteId: null };

  const list = document.getElementById('shipping-rates-list');
  const modal = document.getElementById('shipping-modal');
  const form = document.getElementById('shipping-form');
  const modalTitle = document.getElementById('shipping-modal-title');
  const saveButton = document.getElementById('save-shipping');
  const areaInput = document.getElementById('shipping-area');
  const feeInput = document.getElementById('shipping-fee');
  const activeInput = document.getElementById('shipping-active');
  const toast = document.getElementById('toast');
  const deleteModal = document.getElementById('shipping-delete-confirm-modal');
  const deleteConfirmButton = document.getElementById('shipping-delete-confirm');
  const deleteCancelButton = document.getElementById('shipping-delete-cancel');

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
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0));
  }

  async function getSession() {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error('Your session has expired. Please log in again.');
    return data.session;
  }

  function renderRates() {
    if (!state.rates.length) {
      list.innerHTML = '<div class="empty-state"><h3>No shipping rates yet.</h3><p>Add your first delivery area and fee. You can change it later.</p></div>';
      return;
    }

    list.innerHTML = state.rates.map(rate => `
      <article class="shipping-rate-card">
        <div class="shipping-rate-info">
          <span class="status-badge ${rate.is_active ? 'active' : 'inactive'}">${rate.is_active ? 'Active' : 'Inactive'}</span>
          <h3>${escapeHtml(rate.area_name)}</h3>
          <p>This rate is controlled by the shop owner.</p>
        </div>
        <strong class="shipping-rate-fee">${peso(rate.shipping_fee)}</strong>
        <div class="shipping-actions">
          <button class="button button-secondary button-small" type="button" data-action="edit" data-id="${escapeHtml(rate.id)}">Edit</button>
          <button class="button button-secondary button-small" type="button" data-action="delete" data-id="${escapeHtml(rate.id)}">Delete</button>
        </div>
      </article>`).join('');
  }

  async function loadRates() {
    list.innerHTML = '<p class="loading">Loading shipping rates...</p>';
    try {
      const session = await getSession();
      const { data, error } = await supabaseClient
        .from('shipping_rates')
        .select('id, owner_id, area_name, shipping_fee, is_active, sort_order, created_at, updated_at')
        .eq('owner_id', session.user.id)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      state.rates = data || [];
      renderRates();
    } catch (error) {
      console.error('Load shipping rates error:', error);
      list.innerHTML = '<div class="empty-state"><h3>We could not load shipping rates.</h3><p>Run the shipping-rates.sql file in Supabase first, then refresh this page.</p></div>';
      showToast(error.message || 'Unable to load shipping rates.', true);
    }
  }

  function openModal(rate = null) {
    state.editingId = rate?.id || null;
    modalTitle.textContent = rate ? 'Edit shipping rate' : 'Add shipping rate';
    saveButton.textContent = rate ? 'Save changes' : 'Add rate';
    areaInput.value = rate?.area_name || '';
    feeInput.value = rate?.shipping_fee ?? '';
    activeInput.checked = rate?.is_active !== false;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => areaInput.focus(), 0);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    state.editingId = null;
    form.reset();
    activeInput.checked = true;
  }

  function openDeleteConfirmation(id) {
    const rate = state.rates.find(item => item.id === id);
    if (!rate) return;
    state.pendingDeleteId = id;
    document.getElementById('shipping-delete-message').textContent = `“${rate.area_name}” at ${peso(rate.shipping_fee)} will be permanently removed.`;
    deleteModal.hidden = false;
    deleteConfirmButton.focus();
  }

  function closeDeleteConfirmation() {
    deleteModal.hidden = true;
    state.pendingDeleteId = null;
  }

  async function saveRate(event) {
    event.preventDefault();
    const areaName = areaInput.value.trim();
    const fee = Number(feeInput.value);
    if (!areaName || !Number.isFinite(fee) || fee < 0) return;

    saveButton.disabled = true;
    saveButton.textContent = state.editingId ? 'Saving...' : 'Adding...';
    try {
      const session = await getSession();
      const payload = { area_name: areaName, shipping_fee: fee, is_active: activeInput.checked, updated_at: new Date().toISOString() };
      let error;
      if (state.editingId) {
        ({ error } = await supabaseClient.from('shipping_rates').update(payload).eq('id', state.editingId).eq('owner_id', session.user.id));
      } else {
        const maxSort = state.rates.reduce((max, rate) => Math.max(max, Number(rate.sort_order) || 0), -1);
        ({ error } = await supabaseClient.from('shipping_rates').insert({ ...payload, owner_id: session.user.id, sort_order: maxSort + 1 }));
      }
      if (error) throw error;
      closeModal();
      showToast(state.editingId ? 'Shipping rate updated.' : 'Shipping rate added.');
      await loadRates();
    } catch (error) {
      console.error('Save shipping rate error:', error);
      showToast(error.message || 'Unable to save the shipping rate.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = state.editingId ? 'Save changes' : 'Add rate';
    }
  }

  async function confirmDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;
    deleteConfirmButton.disabled = true;
    try {
      const session = await getSession();
      const { error } = await supabaseClient.from('shipping_rates').delete().eq('id', id).eq('owner_id', session.user.id);
      if (error) throw error;
      closeDeleteConfirmation();
      showToast('Shipping rate deleted.');
      await loadRates();
    } catch (error) {
      console.error('Delete shipping rate error:', error);
      showToast(error.message || 'Unable to delete the shipping rate.', true);
    } finally {
      deleteConfirmButton.disabled = false;
    }
  }

  document.getElementById('add-rate-button').addEventListener('click', () => openModal());
  document.getElementById('close-shipping-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-shipping').addEventListener('click', closeModal);
  form.addEventListener('submit', saveRate);
  deleteCancelButton.addEventListener('click', closeDeleteConfirmation);
  deleteConfirmButton.addEventListener('click', confirmDelete);

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const rate = state.rates.find(item => item.id === button.dataset.id);
    if (!rate) return;
    if (button.dataset.action === 'edit') openModal(rate);
    if (button.dataset.action === 'delete') openDeleteConfirmation(rate.id);
  });

  modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (modal.classList.contains('is-open')) closeModal();
      if (!deleteModal.hidden) closeDeleteConfirmation();
    }
  });

  loadRates();
})();
