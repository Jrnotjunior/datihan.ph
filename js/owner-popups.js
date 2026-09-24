(() => {
  const supabaseClient = window.datihanSupabase;
  const state = { editingId: null, events: [] };

  const list = document.getElementById('events-list');
  const modal = document.getElementById('event-modal');
  const form = document.getElementById('event-form');
  const modalTitle = document.getElementById('event-modal-title');
  const toast = document.getElementById('toast');
  const saveButton = document.getElementById('save-event');

  const fields = {
    id: document.getElementById('event-id'),
    title: document.getElementById('event-title'),
    date: document.getElementById('event-date'),
    status: document.getElementById('event-status'),
    start: document.getElementById('event-start'),
    end: document.getElementById('event-end'),
    location: document.getElementById('event-location'),
    description: document.getElementById('event-description')
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

  function formatDate(value) {
    if (!value) return 'Date to be announced';
    const date = new Date(`${value}T00:00:00`);
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long' }).format(date);
  }

  function formatTime(value) {
    if (!value) return '';
    const [hour, minute] = value.slice(0, 5).split(':').map(Number);
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    return new Intl.DateTimeFormat('en-PH', { hour: 'numeric', minute: '2-digit' }).format(date);
  }

  function formatTimeRange(start, end) {
    const first = formatTime(start);
    const last = formatTime(end);
    if (first && last) return `${first} – ${last}`;
    return first || last || 'Time to be announced';
  }

  function renderEvents() {
    if (!state.events.length) {
      list.innerHTML = '<div class="empty-state"><h3>No pop-up events yet.</h3><p style="margin-top:.5rem">Add your first event and it will appear here and on the public Pop-ups page.</p></div>';
      return;
    }

    list.innerHTML = state.events.map(event => `
      <article class="event-card">
        <div class="event-card-header">
          <div>
            <p class="eyebrow">${escapeHtml(formatDate(event.event_date))}</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <span class="status-badge">${escapeHtml(event.status || 'upcoming')}</span>
        </div>
        <div class="event-meta">
          <span>📍 ${escapeHtml(event.location)}</span>
          <span>🕒 ${escapeHtml(formatTimeRange(event.start_time, event.end_time))}</span>
        </div>
        ${event.description ? `<p class="event-description">${escapeHtml(event.description)}</p>` : ''}
        <div class="event-actions">
          <button class="button button-secondary button-small" type="button" data-action="edit" data-id="${escapeHtml(event.id)}">Edit</button>
          <button class="button button-secondary button-small" type="button" data-action="delete" data-id="${escapeHtml(event.id)}">Delete</button>
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

  async function loadEvents() {
    list.innerHTML = '<p class="loading">Loading events...</p>';
    try {
      const session = await getSession();
      const { data, error } = await supabaseClient
        .from('pop_up_events')
        .select('id, owner_id, title, description, location, event_date, start_time, end_time, status, created_at, updated_at')
        .eq('owner_id', session.user.id)
        .order('event_date', { ascending: true })
        .order('start_time', { ascending: true });

      if (error) throw error;
      state.events = data || [];
      renderEvents();
    } catch (error) {
      console.error('Load pop-up events error:', error);
      list.innerHTML = '<div class="empty-state"><h3>We could not load your events.</h3><p style="margin-top:.5rem">Please refresh and try again.</p></div>';
      showToast(error.message || 'Unable to load pop-up events.', true);
    }
  }

  function openModal(event = null) {
    state.editingId = event?.id || null;
    modalTitle.textContent = event ? 'Edit event' : 'Add event';
    saveButton.textContent = event ? 'Save changes' : 'Save event';
    fields.id.value = event?.id || '';
    fields.title.value = event?.title || '';
    fields.date.value = event?.event_date || '';
    fields.status.value = event?.status || 'upcoming';
    fields.start.value = event?.start_time?.slice(0, 5) || '';
    fields.end.value = event?.end_time?.slice(0, 5) || '';
    fields.location.value = event?.location || '';
    fields.description.value = event?.description || '';
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    window.setTimeout(() => fields.title.focus(), 0);
  }

  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    state.editingId = null;
    form.reset();
    fields.status.value = 'upcoming';
  }

  async function saveEvent(event) {
    event.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = state.editingId ? 'Saving...' : 'Adding...';

    try {
      const session = await getSession();
      const payload = {
        title: fields.title.value.trim(),
        description: fields.description.value.trim() || null,
        location: fields.location.value.trim(),
        event_date: fields.date.value,
        start_time: fields.start.value || null,
        end_time: fields.end.value || null,
        status: fields.status.value,
        updated_at: new Date().toISOString()
      };

      if (state.editingId) {
        const { error } = await supabaseClient
          .from('pop_up_events')
          .update(payload)
          .eq('id', state.editingId)
          .eq('owner_id', session.user.id);
        if (error) throw error;
        closeModal();
        showToast('Pop-up event updated successfully.');
      } else {
        const { error } = await supabaseClient
          .from('pop_up_events')
          .insert({ ...payload, owner_id: session.user.id });
        if (error) throw error;
        closeModal();
        showToast('Pop-up event added successfully.');
      }

      await loadEvents();
    } catch (error) {
      console.error('Save pop-up event error:', error);
      showToast(error.message || 'Unable to save the pop-up event.', true);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = state.editingId ? 'Save changes' : 'Save event';
    }
  }

  async function deleteEvent(id) {
    const event = state.events.find(item => item.id === id);
    if (!event) return;

    if (!window.confirm(`Delete “${event.title}”? This action cannot be undone.`)) return;

    try {
      const session = await getSession();
      const { error } = await supabaseClient
        .from('pop_up_events')
        .delete()
        .eq('id', id)
        .eq('owner_id', session.user.id);
      if (error) throw error;
      showToast('Pop-up event deleted successfully.');
      await loadEvents();
    } catch (error) {
      console.error('Delete pop-up event error:', error);
      showToast(error.message || 'Unable to delete the pop-up event.', true);
    }
  }

  document.getElementById('add-event-button').addEventListener('click', () => openModal());
  document.getElementById('close-event-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-event').addEventListener('click', closeModal);
  form.addEventListener('submit', saveEvent);

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = state.events.find(entry => entry.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'edit') openModal(item);
    if (button.dataset.action === 'delete') deleteEvent(item.id);
  });

  window.addEventListener('datihan-auth-ready', loadEvents);
  if (document.documentElement.classList.contains('auth-ready')) loadEvents();
})();
