(() => {
  const supabaseClient = window.datihanSupabase;
  const state = { editingId: null, pendingDeleteId: null, events: [] };

  const list = document.getElementById('events-list');
  const modal = document.getElementById('event-modal');
  const form = document.getElementById('event-form');
  const modalTitle = document.getElementById('event-modal-title');
  const toast = document.getElementById('toast');
  const saveButton = document.getElementById('save-event');
  const deleteConfirmModal = document.getElementById('event-delete-confirm-modal');
  const deleteConfirmMessage = document.getElementById('event-delete-confirm-message');
  const deleteConfirmButton = document.getElementById('event-delete-confirm-button');

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
    const date = new Date(`${value}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'long',
      timeZone: 'Asia/Manila'
    }).format(date);
  }

  function formatTime(value) {
    if (!value) return '';
    const [hour, minute] = value.slice(0, 5).split(':').map(Number);
    const date = new Date(Date.UTC(2000, 0, 1, hour, minute));
    return new Intl.DateTimeFormat('en-PH', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC'
    }).format(date);
  }

  function formatTimeRange(start, end) {
    const first = formatTime(start);
    const last = formatTime(end);
    if (first && last) return `${first} – ${last}`;
    return first || last || 'Time to be announced';
  }

  function getManilaNow() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());

    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      date: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}:${values.second}`
    };
  }

  // The stored database values remain compatible with the existing schema:
  // upcoming = future, ongoing = happening now, completed = already finished.
  // The public page separately translates these into Upcoming / Happening now / Past.
  function calculateStatus(event, now = getManilaNow()) {
    if (!event?.event_date) return 'upcoming';

    if (event.event_date > now.date) return 'upcoming';
    if (event.event_date < now.date) return 'completed';

    const start = event.start_time ? event.start_time.slice(0, 8) : null;
    const end = event.end_time ? event.end_time.slice(0, 8) : null;

    if (!start && !end) return 'ongoing';
    if (start && now.time < start) return 'upcoming';
    if (end && now.time > end) return 'completed';
    return 'ongoing';
  }

  function statusLabel(status) {
    if (status === 'ongoing') return 'Ongoing';
    if (status === 'completed') return 'Completed';
    return 'Upcoming';
  }

  function getFormStatus() {
    return calculateStatus({
      event_date: fields.date.value,
      start_time: fields.start.value || null,
      end_time: fields.end.value || null
    });
  }

  function updateStatusPreview() {
    const status = getFormStatus();
    fields.status.value = status;
    fields.status.setAttribute('aria-label', `Automatically calculated status: ${statusLabel(status)}`);
  }

  function renderEvents() {
    if (!state.events.length) {
      list.innerHTML = '<div class="empty-state"><h3>No pop-up events yet.</h3><p style="margin-top:.5rem">Add your first event and it will appear here and on the public Pop-ups page.</p></div>';
      return;
    }

    const now = getManilaNow();

    list.innerHTML = state.events.map(event => {
      const realtimeStatus = calculateStatus(event, now);
      return `
      <article class="event-card">
        <div class="event-card-header">
          <div>
            <p class="eyebrow">${escapeHtml(formatDate(event.event_date))}</p>
            <h2>${escapeHtml(event.title)}</h2>
          </div>
          <span class="status-badge">${escapeHtml(statusLabel(realtimeStatus))}</span>
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
    `;
    }).join('');
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
    fields.start.value = event?.start_time?.slice(0, 5) || '';
    fields.end.value = event?.end_time?.slice(0, 5) || '';
    fields.location.value = event?.location || '';
    fields.description.value = event?.description || '';
    updateStatusPreview();
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

  function openDeleteConfirm(id) {
    const event = state.events.find(item => item.id === id);
    if (!event) return;
    state.pendingDeleteId = id;
    deleteConfirmMessage.textContent = `“${event.title}” will be permanently removed from your pop-up events.`;
    deleteConfirmModal.hidden = false;
    deleteConfirmButton.focus();
  }

  function closeDeleteConfirm() {
    deleteConfirmModal.hidden = true;
    state.pendingDeleteId = null;
  }

  async function confirmDeleteEvent() {
    const id = state.pendingDeleteId;
    if (!id) return;

    deleteConfirmButton.disabled = true;
    deleteConfirmButton.textContent = 'Deleting...';

    try {
      const session = await getSession();
      const { error } = await supabaseClient
        .from('pop_up_events')
        .delete()
        .eq('id', id)
        .eq('owner_id', session.user.id);
      if (error) throw error;
      closeDeleteConfirm();
      showToast('Pop-up event deleted successfully.');
      await loadEvents();
    } catch (error) {
      console.error('Delete pop-up event error:', error);
      showToast(error.message || 'Unable to delete the pop-up event.', true);
    } finally {
      deleteConfirmButton.disabled = false;
      deleteConfirmButton.textContent = 'Delete event';
    }
  }

  async function saveEvent(event) {
    event.preventDefault();
    saveButton.disabled = true;
    saveButton.textContent = state.editingId ? 'Saving...' : 'Adding...';

    try {
      const session = await getSession();

      if (fields.start.value && fields.end.value && fields.end.value < fields.start.value) {
        throw new Error('End time cannot be earlier than the start time.');
      }

      const status = getFormStatus();
      const payload = {
        title: fields.title.value.trim(),
        description: fields.description.value.trim() || null,
        location: fields.location.value.trim(),
        event_date: fields.date.value,
        start_time: fields.start.value || null,
        end_time: fields.end.value || null,
        status,
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
        showToast(`Pop-up event updated. Status: ${statusLabel(status)}.`);
      } else {
        const { error } = await supabaseClient
          .from('pop_up_events')
          .insert({ ...payload, owner_id: session.user.id });
        if (error) throw error;
        closeModal();
        showToast(`Pop-up event added. Status: ${statusLabel(status)}.`);
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

  document.getElementById('add-event-button').addEventListener('click', () => openModal());
  document.getElementById('close-event-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-event').addEventListener('click', closeModal);
  document.getElementById('event-delete-cancel-button').addEventListener('click', closeDeleteConfirm);
  document.getElementById('event-delete-confirm-backdrop').addEventListener('click', closeDeleteConfirm);
  deleteConfirmButton.addEventListener('click', confirmDeleteEvent);
  form.addEventListener('submit', saveEvent);

  [fields.date, fields.start, fields.end].forEach(field => {
    field.addEventListener('input', updateStatusPreview);
    field.addEventListener('change', updateStatusPreview);
  });

  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!deleteConfirmModal.hidden) closeDeleteConfirm();
    else if (modal.classList.contains('is-open')) closeModal();
  });

  list.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const item = state.events.find(entry => entry.id === button.dataset.id);
    if (!item) return;
    if (button.dataset.action === 'edit') openModal(item);
    if (button.dataset.action === 'delete') openDeleteConfirm(item.id);
  });

  // Keep the preview and owner list aligned with the same Manila-time rules as the public page.
  window.setInterval(() => {
    if (modal.classList.contains('is-open')) updateStatusPreview();
    if (state.events.length) renderEvents();
  }, 60 * 1000);

  window.addEventListener('datihan-auth-ready', loadEvents);
  if (document.documentElement.classList.contains('auth-ready')) loadEvents();
})();
